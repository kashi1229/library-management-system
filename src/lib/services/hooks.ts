import "server-only";
import { addHours, format } from "date-fns";
import { Book, Reservation } from "@/models";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import { notify } from "@/lib/services/notifications";
import { getSettings } from "@/lib/services/settings";
import type { BookDoc } from "@/types";
import type { ClientSession, Types } from "mongoose";

/**
 * The reservation **queue layer** (spec 14).
 *
 * This module owns the mechanics of the FIFO queue: how many copies are promised to
 * `ready` holds, who gets promoted next, and how a member's own hold is consumed when
 * their book is issued. `lib/services/reservations.ts` builds the member- and
 * staff-facing operations on top of it — `reserveBook`, `cancelReservation`,
 * `fulfilReservation`, `expireStaleReservations` and the list endpoints.
 *
 * ## Why these live here and not in `reservations.ts`
 *
 * Both `circulation.ts` (issue, return, renew) and `reservations.ts` (fulfil, cancel,
 * expire) need them, and `reservations.ts` already imports circulation. Putting the
 * primitives in the service above would make the graph circular:
 *
 * ```
 * reservations.ts -> circulation.ts -> hooks.ts -> reservations.ts
 * ```
 *
 * JavaScript resolves that cycle at call time rather than import time, so it would mostly
 * work — which is worse, not better, because it works until the day an import is hoisted
 * into a `const` and the module body reads an uninitialised binding. This is the same
 * reason `lib/services/refs.ts` exists: the shared thing goes in a leaf that depends only
 * on models and settings, and both services depend on it.
 *
 * ## They take a `session`
 *
 * Every function here is called from inside a `withTransaction` block. A hook that opened
 * its own connection would write *outside* that transaction, which is the exact failure
 * the transaction exists to prevent.
 */

/**
 * How many copies are promised to **ready** reservations, per book.
 *
 * Rule 6: a `ready` reservation consumes one copy from public availability, because it is
 * being held for a named member until `reservationHoldHours` expires. A catalog showing
 * `availableCopies` would therefore promise a book that cannot be collected, which is the
 * single most trust-destroying thing a library catalog can do.
 *
 * `waiting` reservations are deliberately **not** counted — they hold no copy yet.
 *
 * Moved here from `services/books.ts` in Unit 14, and given an optional `session`. It was
 * being read from inside `issueLoan`'s transaction *without* the session, so the hold
 * count was taken from outside the snapshot the rest of the transaction was reasoning
 * about: a hold promoted by a concurrent return could be invisible to the issue that was
 * supposed to respect it. Every caller inside a transaction now passes the session.
 */
export async function getReadyHoldCounts(
  bookIds: Types.ObjectId[],
  session?: ClientSession,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (bookIds.length === 0) return counts;

  const pipeline = [
    { $match: { book: { $in: bookIds }, status: "ready" } },
    { $group: { _id: "$book", holds: { $sum: 1 } } },
  ];

  const aggregate = Reservation.aggregate<{ _id: Types.ObjectId; holds: number }>(pipeline);

  const rows = session ? await aggregate.session(session) : await aggregate;

  for (const row of rows) counts.set(row._id.toString(), row.holds);
  return counts;
}

/**
 * Offer every free copy to the next member in the queue (business rule 6).
 *
 * Called after every return, after cancelling a `ready` hold, and after the expiry sweep —
 * a returned copy is the only event that can make a waiting reservation ready.
 *
 * **Free is `availableCopies - readyHolds`, not `availableCopies`.** Counting only the
 * physical copies is the bug that would hand the same book to three people: the two copies
 * already promised to named members are spoken for, and the queue has to see them as such.
 *
 * The loop cannot spin. Each iteration either promotes one hold — which raises `holds`, so
 * the free count drops by one — or stops, and `holds` can never exceed `totalCopies`.
 * Promoting several in one call is deliberate: a book returned from a bulk reshelving can
 * free three copies at once, and the members who have been waiting longest are exactly the
 * ones who should get them.
 *
 * Returns how many holds were promoted, so a caller can log or assert on it.
 */
export async function promoteReservationQueue(
  bookId: Types.ObjectId,
  session: ClientSession,
): Promise<number> {
  const book = await Book.findById(bookId).session(session).lean<BookDoc>();
  if (!book || book.status !== "active") return 0;

  const title = String(book.title);

  /*
   * **Policy is read outside any caller transaction, and the reason is a bug this unit found.**
   *
   * `getSettings()` *upserts* the singleton, so calling it with a transaction open writes to the
   * `settings` document. The caller `runMaintenance` has just claimed its throttle by writing
   * `lastMaintenanceAt` to that very document, so the two writes are in one transaction and
   * Mongo aborts it: *"Transaction has been aborted"*. The maintenance job 500ed and expired
   * nothing at all, with `tsc`, `eslint` and `next build` all clean.
   *
   * The fix belongs here rather than in the caller: this read is a **policy number**, and
   * invariant 7 requires it to come from Settings *at request time* — reading it before the
   * transaction opens is more correct, not less, because an admin who changes the hold window
   * mid-sweep is picked up rather than pinned to the snapshot. It is also cached for thirty
   * seconds, so this is not an extra query per promotion.
   *
   * The caller must still not wrap a `settings` write in the same transaction. `claimRun`
   * deliberately runs before any transaction opens here.
   */
  const settings = await getSettings();

  let holds = (await getReadyHoldCounts([bookId], session)).get(bookId.toString()) ?? 0;
  let promoted = 0;

  while (book.availableCopies - holds > 0) {
    // `createdAt` then `_id` — the same order as the `reservation_fifo_queue` index, with
    // `_id` breaking ties. Two holds made in the same millisecond otherwise have no
    // defined order, and the same member would report a different position on each load.
    const next = await Reservation.findOne({ book: bookId, status: "waiting" })
      .sort({ createdAt: 1, _id: 1 })
      .session(session);

    if (!next) break;

    const now = new Date();
    next.status = "ready";
    next.readyAt = now;
    next.expiresAt = addHours(now, settings.reservationHoldHours);
    await next.save({ session });

    holds += 1;
    promoted += 1;

    await notify({
      userId: next.member,
      type: "reservation_ready",
      title: "Your reserved book is ready",
      message: `“${title}” is being held at the desk until ${format(next.expiresAt, "d MMM, HH:mm")}. Collect it before then and it is yours.`,
      link: "/reservations",
      session,
    });
  }

  return promoted;
}

/**
 * Consume the member's own ready hold when their book is issued (business rule 1).
 *
 * Issuing to a member who has a `ready` reservation for that book *is* that hold being
 * collected, so the reservation must end up `fulfilled` and linked to the loan rather than
 * left dangling as a hold on a book they now have at home — which would keep a copy
 * permanently out of public availability.
 *
 * Returns whether a hold was consumed, so the caller can report and audit it.
 *
 * **No audit row here.** The caller is always `issueLoan`, which already writes
 * `loan.issue` and records `fulfilledHold` in its metadata. Writing a second entry from
 * here would give one collection two audit rows describing one event.
 */
export async function fulfilReadyReservationIfAny(
  memberId: Types.ObjectId,
  bookId: Types.ObjectId,
  loanId: Types.ObjectId,
  session: ClientSession,
): Promise<boolean> {
  const ready = await Reservation.findOne({ book: bookId, member: memberId, status: "ready" }).session(
    session,
  );

  if (!ready) return false;

  ready.status = "fulfilled";
  ready.fulfilledLoan = loanId;
  await ready.save({ session });

  return true;
}

/**
 * Live reservations **by other members** on a book, for the renewal rule.
 *
 * A member's own hold must not block their own renewal, hence the exclusion — otherwise a
 * member who reserved, collected, and then tried to renew could never do it.
 *
 * Business rule 3 blocks renewal whenever anyone else is waiting, so this is the check
 * that decides it and it is deliberately a real indexed count rather than a stub.
 */
export async function countOtherReservations(
  bookId: Types.ObjectId,
  exceptMemberId: Types.ObjectId,
  session: ClientSession,
): Promise<number> {
  return Reservation.countDocuments(
    {
      book: bookId,
      member: { $ne: exceptMemberId },
      status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
    },
    { session },
  );
}