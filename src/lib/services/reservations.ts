import "server-only";
import { Types, type ClientSession } from "mongoose";
import { AppError } from "@/lib/api";
import { withTransaction } from "@/lib/db";
import { Book, Loan, Reservation, User } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { getSettings } from "@/lib/services/settings";
import { bookRefOr, bookRefs, memberRefOr, memberRefs } from "@/lib/services/refs";
import { getReadyHoldCounts, promoteReservationQueue } from "@/lib/services/hooks";
import { issueLoanInSession } from "@/lib/services/circulation";
import {
  ACTIVE_RESERVATION_STATUSES,
  MEMBER_HISTORY_LIMIT,
  isActiveReservationStatus,
  type ReservationStatus,
} from "@/lib/constants";
import type { ListReservationsQuery } from "@/lib/validators/reservation";
import type {
  Actor,
  BookDoc,
  LoanBookRef,
  LoanSummary,
  MemberReservation,
  MemberReservations,
  PageMeta,
  QueueEntry,
  QueueInfo,
  ReservationSummary,
} from "@/types";

/**
 * Reservation service (F8, spec 14).
 *
 * The queue mechanics live in `lib/services/hooks.ts`; this module owns everything a
 * member or a librarian actually asks for: joining a queue, leaving it, collecting a ready
 * hold, and reading the state of either.
 *
 * Every policy number comes from `getSettings()` at request time (invariant 7) — there is
 * deliberately no `3` in this file for `maxReservationsPerMember` and no `48` for
 * `reservationHoldHours`.
 */

const RESERVATION_FIELDS =
  "book member status readyAt expiresAt fulfilledLoan cancelledBy createdAt updatedAt";

type MemberBlock = { id: string; name: string; membershipId: string | null };

/** Staff may act on anyone's hold; a member only on their own. */
function isStaff(role: Actor["role"]): boolean {
  return role === "admin" || role === "librarian";
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Whole hours until `target`, **rounded up and never negative**.
 *
 * Rounded up because the alternative is a countdown that reads "0 hours left" while a copy
 * is still sitting on the shelf with this member's name on it — the single most confusing
 * thing a hold screen could say. Never negative because the sweep that expires holds runs
 * lazily, so a page loaded a moment before it ran must not render "expired 3 hours ago".
 *
 * Exported because `services/members.ts` derives the same figure for the member record's
 * Reservations tab. Two copies of the rounding rule is one place where the record tab and
 * the member's own page would disagree about how long a hold has left.
 */
export function hoursUntil(target: Date, now: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 3_600_000));
}

/**
 * Turn a lean reservation into the wire shape. **The only way out of this service.**
 *
 * One serialiser because a list endpoint must have exactly one: attaching a derived field
 * at three call sites means remembering to add it at the other two next time, and the
 * Unit 09 catalog shipped a card reading "NaN of 1 available" for exactly that reason.
 */
function toReservationSummary(
  doc: Record<string, unknown>,
  book: LoanBookRef,
  member: MemberBlock,
  queuePosition: number | null,
  now: Date,
): ReservationSummary {
  const status = doc.status as ReservationStatus;
  const expiresAt = (doc.expiresAt as Date | null) ?? null;
  const fulfilledLoan = doc.fulfilledLoan as unknown;

  return {
    id: String(doc._id),
    status,
    book,
    member,
    queuePosition,
    requestedAt: (doc.createdAt as Date).toISOString(),
    readyAt: doc.readyAt ? (doc.readyAt as Date).toISOString() : null,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    hoursUntilExpiry: status === "ready" && expiresAt ? hoursUntil(expiresAt, now) : null,
    fulfilledLoanId: fulfilledLoan ? String(fulfilledLoan) : null,
    cancelledAt: status === "cancelled" ? (doc.updatedAt as Date).toISOString() : null,
  };
}

/** The same row without the member block, for a member's view of their own holds. */
function toMemberReservation(summary: ReservationSummary): MemberReservation {
  return {
    id: summary.id,
    status: summary.status,
    book: summary.book,
    queuePosition: summary.queuePosition,
    requestedAt: summary.requestedAt,
    readyAt: summary.readyAt,
    expiresAt: summary.expiresAt,
    hoursUntilExpiry: summary.hoursUntilExpiry,
    fulfilledLoanId: summary.fulfilledLoanId,
    cancelledAt: summary.cancelledAt,
  };
}

function memberBlock(ref: { id: string; name: string; membershipId: string | null }): MemberBlock {
  return { id: ref.id, name: ref.name, membershipId: ref.membershipId };
}

/** Attach the book and member a row needs, in two batched queries. */
async function decorate(
  rows: Array<Record<string, unknown>>,
  positions: Map<string, number>,
  now: Date,
): Promise<ReservationSummary[]> {
  if (rows.length === 0) return [];

  const [refs, members] = await Promise.all([
    bookRefs(rows.map((row) => row.book)),
    memberRefs(rows.map((row) => row.member)),
  ]);

  return rows.map((row) =>
    toReservationSummary(
      row,
      bookRefOr(refs, row.book),
      memberBlock(memberRefOr(members, row.member)),
      positions.get(String(row._id)) ?? null,
      now,
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* The queue order — one algorithm, three callers                               */
/* -------------------------------------------------------------------------- */

/**
 * FIFO place of every **waiting** reservation on the given books.
 *
 * Keyed by **reservation id**, not member, because three callers need different slices of
 * the same answer and slicing the *order* three ways is how the three drift: the member
 * record, the member's reservations page and the staff register each used to work it out
 * for themselves.
 *
 * **A `ready` hold is counted but not numbered.** It occupies a place in the order — three
 * copies returned means three holds sit at the head, so the first person still `waiting` is
 * #4, which is the truth since three people will be served before them — but it carries no
 * *number of its own*, because a member whose copy is already set aside is not "waiting for
 * a place". Counting only `waiting` would tell every member in a busy queue they were next.
 * Returning a number for `ready` as well would label two members #1 on the same book.
 *
 * `ReservationSummary.queuePosition` and `QueueEntry.position` therefore both use this, and
 * both are `null` for anything that is not `waiting` — one rule, two shapes.
 *
 * The sort is `createdAt: 1, _id: 1` to match the `reservation_fifo_queue` index, with
 * `_id` as the tiebreaker. Without it two holds created in the same millisecond have no
 * defined order and the same hold reports a different position on each load.
 */
export async function activeQueuePositions(
  bookIds: unknown[],
  session?: ClientSession,
): Promise<Map<string, number>> {
  const positions = new Map<string, number>();

  const unique = [...new Set(bookIds.map(String))].filter((id) => Types.ObjectId.isValid(id));
  if (unique.length === 0) return positions;

  const query = Reservation.find({
    book: { $in: unique.map((id) => new Types.ObjectId(id)) },
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("book member status");

  const scoped = session ? query.session(session) : query;
  const queue = await scoped.lean<Array<{ _id: Types.ObjectId; book: Types.ObjectId; status: string }>>();

  const seen = new Map<string, number>();
  for (const entry of queue) {
    const key = String(entry.book);
    const place = (seen.get(key) ?? 0) + 1;
    seen.set(key, place);

    if (entry.status === "waiting") positions.set(String(entry._id), place);
  }

  return positions;
}

/**
 * The live queue for one book, in order.
 *
 * One read answers three questions the detail page and the staff "View queue" sheet ask:
 * how long is the queue, where does *this* member stand, and who is in it. Deriving them
 * from separate reads is how a queue length and a queue position end up describing
 * different moments.
 */
export async function getQueueInfo(bookId: string, memberId?: Types.ObjectId): Promise<QueueInfo> {
  if (!Types.ObjectId.isValid(bookId)) {
    throw AppError.notFound("That book could not be found.");
  }

  const id = new Types.ObjectId(bookId);

  const queue = await Reservation.find({
    book: id,
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("member status createdAt readyAt expiresAt")
    .lean<Array<Record<string, unknown>>>();

  const members = await memberRefs(queue.map((row) => row.member));

  /*
   * Position counter advanced across **every** active hold, `ready` included, so the
   * arithmetic matches `activeQueuePositions`. It is written this way rather than with an
   * index so the two cannot drift apart if a status is ever added to the queue.
   */
  let seen = 0;

  const entries: QueueEntry[] = queue.map((row) => {
    const member = memberBlock(memberRefOr(members, row.member));
    const status = row.status as ReservationStatus;

    // Advanced across **every** active hold, `ready` included, so the arithmetic matches
    // `activeQueuePositions`: three copies returned means the first person still waiting is
    // #4. It is written as a running counter rather than an index so the two cannot drift.
    const place = (seen += 1);

    return {
      id: String(row._id),
      member,
      status,
      // Same rule as `ReservationSummary.queuePosition`: a place in line is only meaningful
      // while you are actually in line.
      position: status === "waiting" ? place : null,
      requestedAt: (row.createdAt as Date).toISOString(),
      readyAt: row.readyAt ? (row.readyAt as Date).toISOString() : null,
      expiresAt: row.expiresAt ? (row.expiresAt as Date).toISOString() : null,
    };
  });

  const mine = memberId
    ? entries.find((entry) => entry.member.id === memberId.toString())
    : undefined;

  return {
    bookId: String(bookId),
    queueLength: queue.length,
    // `null` unless they hold a `waiting` place — a `ready` member's own place is carried by
    // the countdown, not by a number, and giving them `1` would imply they are queued
    // alongside whoever genuinely is.
    position: mine?.position ?? null,
    entries,
  };
}

/* -------------------------------------------------------------------------- */
/* Expiry (business rule 7)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Close out `ready` holds whose window has passed, then offer each freed copy to the next
 * member waiting.
 *
 * Invoked lazily at the start of `reserveBook` and `listMyReservations`, and again by the
 * maintenance job in Unit 16. **Lazy rather than scheduled** because a hold that is not
 * closed is a copy that stays invisible to the catalog — the book reads "all copies out"
 * to everyone else while it physically sits on a shelf waiting for somebody who has given
 * up.
 *
 * **No audit row, deliberately.** There is no actor: nobody did this, the clock did.
 * Writing one would mean inventing a "system" user — which is exactly what Unit 13 got
 * wrong when `createFineIfLate` attributed every fine to the loan's id. The state change
 * from `ready` to `expired`, plus the member's `reservation_expired` notification, is the
 * record. (`reservation.expire` stays declared in `AuditAction` for a future manual sweep
 * that does have a human behind it.)
 */
export async function expireStaleReservations(bookIds?: string[]): Promise<number> {
  const now = new Date();

  const filter: Record<string, unknown> = { status: "ready", expiresAt: { $lt: now } };
  if (bookIds && bookIds.length > 0) {
    const ids = bookIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    if (ids.length > 0) filter.book = { $in: ids };
  }

  return withTransaction(async (session) => {
    const stale = await Reservation.find(filter)
      .select("book member status expiresAt")
      .session(session)
      .lean<Array<{ _id: Types.ObjectId; book: Types.ObjectId; member: Types.ObjectId }>>();

    if (stale.length === 0) return 0;

    await Reservation.updateMany(
      { _id: { $in: stale.map((row) => row._id) } },
      { $set: { status: "expired" } },
      { session },
    );

    // Only the book titles are needed for the expiry messages; the member id rides along on
    // each row for `notify`, so there is no member query here at all.
    const refs = await bookRefs(stale.map((row) => row.book));

    for (const row of stale) {
      const book = bookRefOr(refs, row.book);
      await notify({
        userId: row.member,
        type: "reservation_expired",
        title: "Your hold expired",
        message: `The hold on “${book.title}” has passed, so the copy has gone to the next reader in the queue. You are welcome to join the queue again.`,
        link: "/reservations",
        session,
      });
    }

    // Rule 7: an expired hold released a copy, so the queue is offered it again.
    const affected = new Set(stale.map((row) => String(row.book)));
    for (const bookId of affected) {
      await promoteReservationQueue(new Types.ObjectId(bookId), session);
    }

    return stale.length;
  });
}

/**
 * Run the sweep without letting it break the read it is protecting.
 *
 * A failed expiry means a stale hold stays on the shelf, which is a real problem — but it
 * is a much smaller one than the page the member actually asked for refusing to load. The
 * failure is logged server-side rather than swallowed silently.
 */
async function sweepQuietly(): Promise<void> {
  try {
    await expireStaleReservations();
  } catch (error) {
    console.error("[reservations] lazy expiry sweep failed", error);
  }
}

/* -------------------------------------------------------------------------- */
/* Reserve (business rule 5)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Join the queue for a book (business rule 5).
 *
 * ## The refusals, in the order they are checked
 *
 * The order is **specific before general**, on the Unit 12 lesson. A member who already has
 * the book on loan and is looking at a free copy satisfies two of these rules at once;
 * checked in a different order they are told to visit the desk, walk over, and be told
 * again that they cannot borrow the copy they are holding. "You already have this on loan"
 * names the thing they have to fix.
 *
 * 1. **Active loan of the book** — they must return it first. One indexed `exists`, and the
 *    cheapest of the four.
 * 2. **Already waiting or ready** — they can cancel it, so say that.
 * 3. **Reservation limit** — they must drop one to take another, and the message names both
 *    numbers.
 * 4. **A copy is effectively free** — the last check, because it is the one that costs a
 *    hold-count read and it is the *permissive* answer. Refusing first would mean running a
 *    query for every reader on a page where most books are in stock.
 *
 * **The availability read subtracts ready holds** (rule 6). A copy promised to somebody
 * else is not available to this member, and letting them queue for a book that is already
 * theirs-in-waiting is how a library hands the same copy to two people.
 *
 * **No transaction, on purpose.** This writes one document. The audit row and the position
 * read are separate by design (`logAudit` must never roll back the action it describes), and
 * the one real race — two simultaneous reserves by the same member — is closed by the
 * `reservation_one_active_per_member_book` partial unique index, which surfaces as a clean
 * 409 through `handler`. Wrapping a single insert in a transaction would cost a replica set
 * for no added safety.
 */
export async function reserveBook(bookId: string, actor: Actor): Promise<ReservationSummary> {
  if (!Types.ObjectId.isValid(bookId)) {
    throw AppError.notFound("That book could not be found.");
  }

  // A hold that timed out must be closed *before* availability is read, or its copy still
  // counts against the shelf and the member is told the book is out while it sits there.
  await sweepQuietly();

  const id = new Types.ObjectId(bookId);
  const settings = await getSettings();
  const now = new Date();

  /* ------------------------------- Member ------------------------------- */
  const member = await User.findById(actor.id).lean<{ name: string; role: string; status: string }>();
  if (!member || member.role !== "member") {
    throw AppError.forbidden("Only library members can reserve books.");
  }

  if (member.status !== "active") {
    throw AppError.rule(
      "Your account is suspended, so you cannot reserve books. Please contact the library desk to reactivate it.",
    );
  }

  /* -------------------------------- Book -------------------------------- */
  const book = await Book.findById(id).lean<BookDoc>();
  if (!book) throw AppError.notFound("That book could not be found.");

  const title = String(book.title);

  if (book.status !== "active") {
    throw AppError.rule(`“${title}” is archived, so it cannot be reserved. Restore it first.`, {
      bookId: "This book is archived",
    });
  }

  /* ------------------------------ The rules ------------------------------ */
  if (await Loan.exists({ member: actor.id, book: id, status: "active" })) {
    throw AppError.rule(
      `You already have “${title}” on loan. Return it before reserving it again.`,
      { bookId: "Already on loan to you" },
    );
  }

  const existing = await Reservation.findOne({
    book: id,
    member: actor.id,
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
  })
    .select("status")
    .lean<{ status: ReservationStatus }>();

  if (existing) {
    throw AppError.rule(
      existing.status === "ready"
        ? `“${title}” is already being held for you. Collect it before the hold expires.`
        : `You already reserved “${title}”. Cancel it first if you no longer want it.`,
      { bookId: "Already reserved" },
    );
  }

  const activeCount = await Reservation.countDocuments({
    member: actor.id,
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
  });

  if (activeCount >= settings.maxReservationsPerMember) {
    throw AppError.rule(
      `You already have ${activeCount} ${activeCount === 1 ? "book" : "books"} on a waiting list. The limit is ${settings.maxReservationsPerMember}.`,
      { bookId: `The limit is ${settings.maxReservationsPerMember} reservations` },
    );
  }

  const holds = (await getReadyHoldCounts([id])).get(id.toString()) ?? 0;
  const effective = Math.min(book.totalCopies, Math.max(0, book.availableCopies - holds));

  if (effective > 0) {
    throw AppError.rule(
      `Copies of “${title}” are available right now — visit the desk and a librarian can issue one to you today.`,
      { bookId: "Copies are available" },
    );
  }

  /* ------------------------------- Create ------------------------------- */
  const [created] = await Reservation.create([{ book: id, member: actor.id, status: "waiting" }]);

  const position = (await activeQueuePositions([id])).get(String(created._id)) ?? null;

  await logAudit({
    actor,
    action: "reservation.create",
    entityType: "Reservation",
    entityId: created._id,
    summary: `${member.name} reserved “${title}”${position ? ` (position ${position})` : ""}`,
    meta: { book: title, position },
  });

  const [refs, members] = await Promise.all([bookRefs([id]), memberRefs([actor.id])]);

  return toReservationSummary(
    created.toObject() as Record<string, unknown>,
    bookRefOr(refs, id),
    memberBlock(memberRefOr(members, actor.id)),
    position,
    now,
  );
}

/* -------------------------------------------------------------------------- */
/* Cancel                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Leave a queue, by the member who owns it or by any staff member.
 *
 * **Cancelling a `ready` hold promotes the queue inside the same transaction.** A ready
 * hold was holding a real copy out of public availability; releasing it without offering
 * that copy to the person who has been waiting longest would leave the book reading "all
 * copies out" to everybody while it sat on the shelf. Same rule as a return, same code.
 *
 * The closed states are **terminal**. A second cancel is a 400 with the state named, not a
 * silent no-op — otherwise a member pressing the button twice after a slow connection is
 * told "cancelled" twice for one cancellation.
 */
export async function cancelReservation(id: string, actor: Actor): Promise<ReservationSummary> {
  if (!Types.ObjectId.isValid(id)) {
    throw AppError.notFound("That reservation could not be found.");
  }

  return withTransaction(async (session) => {
    const reservation = await Reservation.findById(id).session(session);
    if (!reservation) throw AppError.notFound("That reservation could not be found.");

    const owner = String(reservation.member) === String(actor.id);
    if (!owner && !isStaff(actor.role)) {
      throw AppError.forbidden("You can only cancel your own reservations.");
    }

    const [book, member] = await Promise.all([
      Book.findById(reservation.book).session(session).lean<BookDoc>(),
      User.findById(reservation.member).session(session).lean<{ name: string }>(),
    ]);

    const title = book ? String(book.title) : "this book";
    const memberName = member ? member.name : "This member";

    if (!isActiveReservationStatus(reservation.status)) {
      throw AppError.rule(`The reservation for “${title}” is already ${reservation.status}.`);
    }

    const wasReady = reservation.status === "ready";

    reservation.status = "cancelled";
    reservation.cancelledBy = actor.id;
    await reservation.save({ session });

    if (wasReady) {
      await promoteReservationQueue(reservation.book, session);
    }

    await logAudit({
      actor,
      action: "reservation.cancel",
      entityType: "Reservation",
      entityId: reservation._id,
      summary: `Cancelled ${memberName}'s reservation for “${title}”`,
      meta: { book: title, member: memberName, wasReady, byStaff: !owner },
      session,
    });

    await notify({
      userId: reservation.member,
      type: "reservation_cancelled",
      title: "Reservation cancelled",
      message: wasReady
        ? `The hold on “${title}” has been released, so it is available to borrow again.`
        : `You are no longer waiting for “${title}”.`,
      link: "/reservations",
      session,
    });

    const [refs, members, positions] = await Promise.all([
      bookRefs([reservation.book]),
      memberRefs([reservation.member]),
      activeQueuePositions([reservation.book], session),
    ]);

    return toReservationSummary(
      reservation.toObject() as Record<string, unknown>,
      bookRefOr(refs, reservation.book),
      memberBlock(memberRefOr(members, reservation.member)),
      positions.get(String(reservation._id)) ?? null,
      new Date(),
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Fulfil                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Issue a book straight out of a `ready` hold.
 *
 * **One transaction, and that is the whole reason `issueLoan` was split.** MongoDB has no
 * nested transactions, so this calls `issueLoanInSession` — the same code path the
 * circulation desk uses, every rule intact — rather than `issueLoan`. Calling the public
 * one from inside a transaction would commit the loan outside it, which is the exact
 * failure invariant 5 exists to prevent: the member would have a book and a hold that had
 * quietly kept a copy out of the catalog.
 *
 * `issueLoanInSession` already consumes the member's own ready hold (rule 1) and links the
 * loan to it, so the defensive check afterwards is not belt-and-braces for its own sake: if
 * the hold did not close, the transaction aborts and **nothing** is issued, rather than
 * handing out a book that was never actually being held for anybody.
 *
 * **Only `ready`.** A `waiting` reservation has no copy set aside, so "fulfilling" it would
 * be issuing a book nobody has returned. The refusal says so rather than reading as a bug.
 */
export async function fulfilReservation(
  id: string,
  actor: Actor,
): Promise<{ reservation: ReservationSummary; loan: LoanSummary }> {
  if (!Types.ObjectId.isValid(id)) {
    throw AppError.notFound("That reservation could not be found.");
  }

  return withTransaction(async (session) => {
    const reservation = await Reservation.findById(id).session(session);
    if (!reservation) throw AppError.notFound("That reservation could not be found.");

    const book = await Book.findById(reservation.book).session(session).lean<BookDoc>();
    const title = book ? String(book.title) : "this book";

    if (reservation.status !== "ready") {
      throw AppError.rule(
        reservation.status === "waiting"
          ? `“${title}” is not ready to collect yet — no copy has been returned. Wait for the ready notification first.`
          : `The reservation for “${title}” is already ${reservation.status}, so there is nothing to issue.`,
      );
    }

    const loan = await issueLoanInSession(
      { memberId: String(reservation.member), bookId: String(reservation.book) },
      actor,
      session,
    );

    const closed = await Reservation.findById(reservation._id).session(session);
    if (!closed || closed.status !== "fulfilled") {
      throw AppError.rule(
        `“${title}” could not be collected against this hold, so nothing was issued. Check the shelf count and try again.`,
      );
    }

    const member = await User.findById(reservation.member).session(session).lean<{ name: string }>();
    const memberName = member ? member.name : "This member";

    await logAudit({
      actor,
      action: "reservation.fulfil",
      entityType: "Reservation",
      entityId: closed._id,
      summary: `Issued “${title}” to ${memberName} from a ready hold`,
      meta: { book: title, member: memberName, loan: loan.id },
      session,
    });

    const [refs, members, positions] = await Promise.all([
      bookRefs([closed.book]),
      memberRefs([closed.member]),
      activeQueuePositions([closed.book], session),
    ]);

    return {
      reservation: toReservationSummary(
        closed.toObject() as Record<string, unknown>,
        bookRefOr(refs, closed.book),
        memberBlock(memberRefOr(members, closed.member)),
        positions.get(String(closed._id)) ?? null,
        new Date(),
      ),
      loan,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Sort per tab, because the three tabs answer different questions.
 *
 * - **Ready only** → the hold closest to expiring first. That is the row a librarian has to
 *   act on today; expiry order is the urgency order.
 * - **Waiting only**, or `waiting` + `ready` → FIFO. The queue sheet and the queue tab are
 *   the same question ("who is next") and must read in the same order as the promotion
 *   loop promotes.
 * - **Anything else** → most recently closed first, so History reads as a log.
 *
 * Every sort ends in `_id`. Two reservations made in the same millisecond otherwise have no
 * defined order and page 1 and page 2 of the same filter can disagree about them.
 */
function sortFor(statuses: ReservationStatus[] | undefined): Record<string, 1 | -1> {
  const set = statuses ?? [];
  const onlyReady = set.length === 1 && set[0] === "ready";

  if (onlyReady) return { expiresAt: 1, _id: 1 };
  if (set.every((status) => status === "waiting" || status === "ready")) {
    return { createdAt: 1, _id: 1 };
  }
  return { updatedAt: -1, _id: -1 };
}

/**
 * The staff register (F8): tabs Ready / Waiting / History, plus a per-book queue.
 *
 * `status` is optional, so no filter means *every* reservation rather than silently hiding
 * the closed ones. Positions come from the same ordered read the queue itself is promoted
 * from, so the number on a row is the number the promotion would use.
 */
export async function listReservations(query: ListReservationsQuery): Promise<{
  items: ReservationSummary[];
  meta: PageMeta;
}> {
  const now = new Date();

  const filter: Record<string, unknown> = {};
  if (query.status && query.status.length > 0) filter.status = { $in: query.status };
  if (query.bookId) filter.book = new Types.ObjectId(query.bookId);

  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    Reservation.countDocuments(filter),
    Reservation.find(filter)
      .select(RESERVATION_FIELDS)
      .sort(sortFor(query.status))
      .skip(skip)
      .limit(limit)
      .lean<Array<Record<string, unknown>>>(),
  ]);

  const positions = await activeQueuePositions(rows.map((row) => row.book));

  return {
    items: await decorate(rows, positions, now),
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

/**
 * A member's own holds, already grouped into ready / waiting / past.
 *
 * **Grouped by the server.** The member screen has no pagination and no tabs — it is three
 * sections — so grouping a paginated list in the browser would quietly drop rows the moment
 * a member has more than one page of history, which is exactly what "Past" always is.
 *
 * **The sweep runs first.** A hold that timed out has to leave `ready` before the groups are
 * built, or the page leads with a countdown on a copy that was given away hours ago. That
 * is the whole reason this list can be trusted to say "ready".
 *
 * `past` is capped at `MEMBER_HISTORY_LIMIT` and `pastTotal` is the true count, so the UI
 * can say it is showing the most recent N of M rather than implying the list is everything.
 */
export async function listMyReservations(memberId: Types.ObjectId): Promise<MemberReservations> {
  await sweepQuietly();

  const now = new Date();
  const active = { $in: [...ACTIVE_RESERVATION_STATUSES] };
  const closed = { $nin: [...ACTIVE_RESERVATION_STATUSES] };

  const [openRows, pastRows, pastTotal] = await Promise.all([
    Reservation.find({ member: memberId, status: active })
      .select(RESERVATION_FIELDS)
      .sort({ createdAt: 1, _id: 1 })
      .lean<Array<Record<string, unknown>>>(),
    Reservation.find({ member: memberId, status: closed })
      .select(RESERVATION_FIELDS)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(MEMBER_HISTORY_LIMIT)
      .lean<Array<Record<string, unknown>>>(),
    Reservation.countDocuments({ member: memberId, status: closed }),
  ]);

  const positions = await activeQueuePositions(openRows.map((row) => row.book));
  const [open, past] = await Promise.all([
    decorate(openRows, positions, now),
    decorate(pastRows, positions, now),
  ]);

  return {
    ready: open.filter((row) => row.status === "ready").map(toMemberReservation),
    waiting: open.filter((row) => row.status === "waiting").map(toMemberReservation),
    past: past.map(toMemberReservation),
    pastTotal,
  };
}