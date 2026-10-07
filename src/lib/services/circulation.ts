import "server-only";
import { Types } from "mongoose";
import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay } from "date-fns";
import { AppError } from "@/lib/api";
import { withTransaction } from "@/lib/db";
import { Book, Fine, Loan, Reservation, User } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { getSettings } from "@/lib/services/settings";
import { getReadyHoldCounts } from "@/lib/services/books";
import {
  createFineIfLate,
  countOtherReservations,
  fulfilReadyReservationIfAny,
  promoteReservationQueue,
} from "@/lib/services/hooks";
import {
  DUE_SOON_DAYS,
  type FineStatus,
  type LoanStatus,
} from "@/lib/constants";
import type { IssueLoanInput, ListLoansQuery, ListMyLoansQuery } from "@/lib/validators/loan";
import type {
  Actor,
  BookDoc,
  CloudinaryImage,
  LoanBookRef,
  LoanDisplayState,
  LoanFineRef,
  LoanMemberRef,
  LoanReturnResult,
  LoanSummary,
  PageMeta,
  UserDoc,
} from "@/types";

/**
 * Circulation service — issue, return, renew and list loans (F7, spec 11).
 *
 * **All three mutations run inside `withTransaction`** (invariant 5). Issuing a book
 * touches the loan collection *and* the book's copy count, so a failure halfway through
 * would otherwise leave a loan with no copy removed, or a copy removed with no loan —
 * and the second of those is invisible until a member asks why they cannot borrow it.
 *
 * Every policy number comes from `getSettings()` at request time (invariant 7). There is
 * deliberately no constant for `maxActiveLoans` or `loanPeriodDays` anywhere in this file.
 */

/** Staff may act on anyone's loan; a member only on their own. */
function isStaff(role: Actor["role"]): boolean {
  return role === "admin" || role === "librarian";
}

/* -------------------------------------------------------------------------- */
/* The derived loan state — one rule, one place                                */
/* -------------------------------------------------------------------------- */

/**
 * Derive a loan's display state and how many days are left or late.
 *
 * **`overdue` and `due_soon` are derived and never stored** (invariant 4), so they are
 * computed in exactly one place and put on the wire. The member record
 * (`services/members.ts`) imports this rather than growing a second copy — two answers to
 * "is this book late?" is the bug worth designing out.
 *
 * **Calendar days, not 24-hour periods** (invariant 12, via date-fns
 * `differenceInCalendarDays`). A book due at 23:00 yesterday and returned at 01:00 today
 * is **one** day late. Counting whole 24-hour blocks would charge nothing for a book that
 * crossed midnight, and the fine — `daysOverdue × ratePerDay` — would silently follow
 * that wrong number.
 *
 * Days are rounded **up** for lateness: a book due an hour ago is 1 day overdue, not 0.
 * A "0 days overdue" badge on an overdue loan is worse than no badge.
 */
export function deriveLoanState(
  loan: { status: LoanStatus; dueDate: Date },
  now: Date,
): { view: LoanDisplayState; daysLeft: number; daysOverdue: number } {
  if (loan.status === "returned") return { view: "returned", daysLeft: 0, daysOverdue: 0 };

  const daysLeft = differenceInCalendarDays(loan.dueDate, now);

  if (daysLeft < 0) {
    return { view: "overdue", daysLeft, daysOverdue: Math.abs(daysLeft) };
  }
  if (daysLeft <= DUE_SOON_DAYS) {
    return { view: "due_soon", daysLeft, daysOverdue: 0 };
  }
  return { view: "on_time", daysLeft, daysOverdue: 0 };
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Book references for a set of ids, in one query.
 *
 * Exported because `services/members.ts` needs exactly this shape for the same rows, and
 * two definitions of "a book shown next to a loan" is how the Unit 08 payload drifted.
 */
export async function bookRefs(ids: unknown[]): Promise<Map<string, LoanBookRef>> {
  const refs = new Map<string, LoanBookRef>();

  const unique = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
  if (unique.length === 0) return refs;

  const docs = await Book.find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) } })
    .select("title slug authors cover")
    .lean<Array<Record<string, unknown>>>();

  for (const doc of docs) {
    refs.set(String(doc._id), {
      id: String(doc._id),
      title: String(doc.title ?? ""),
      slug: String(doc.slug ?? ""),
      authors: Array.isArray(doc.authors) ? (doc.authors as string[]) : [],
      cover: (doc.cover as CloudinaryImage | null) ?? null,
    });
  }

  return refs;
}

/**
 * A row's book, or an honest placeholder if the book is gone.
 *
 * Deletion is refused while a book has loan history, so this should not happen — but
 * "should not happen" is exactly the assumption that produces a blank row. A named
 * placeholder renders; `undefined` crashes the list.
 */
export function bookRefOr(refs: Map<string, LoanBookRef>, id: unknown): LoanBookRef {
  return (
    refs.get(String(id)) ?? {
      id: String(id),
      title: "No longer in the catalog",
      slug: "",
      authors: [],
      cover: null,
    }
  );
}

/** Member references for a set of ids, in one query. Email is deliberately excluded. */
async function memberRefs(ids: unknown[]): Promise<Map<string, LoanMemberRef>> {
  const refs = new Map<string, LoanMemberRef>();

  const unique = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
  if (unique.length === 0) return refs;

  const docs = await User.find({ _id: { $in: unique.map((id) => new Types.ObjectId(id)) } })
    .select("name membershipId avatar")
    .lean<Array<Record<string, unknown>>>();

  for (const doc of docs) {
    refs.set(String(doc._id), {
      id: String(doc._id),
      name: String(doc.name ?? ""),
      // Staff rows read better with it; a member's own loans carrying their own
      // membership ID is harmless because it is already theirs.
      membershipId: (doc.membershipId as string | null) ?? null,
      avatar: (doc.avatar as CloudinaryImage | null) ?? null,
    });
  }

  return refs;
}

function memberRefOr(refs: Map<string, LoanMemberRef>, id: unknown): LoanMemberRef {
  return (
    refs.get(String(id)) ?? {
      id: String(id),
      name: "Unknown member",
      membershipId: null,
      avatar: null,
    }
  );
}

/** Turn a lean loan plus its resolved book/member into the wire shape. */
function toLoan(
  doc: Record<string, unknown>,
  book: LoanBookRef,
  member: LoanMemberRef,
  now: Date,
): LoanSummary {
  const status = doc.status as LoanStatus;
  const dueDate = doc.dueDate as Date;
  const { view, daysLeft, daysOverdue } = deriveLoanState({ status, dueDate }, now);

  return {
    id: String(doc._id),
    book,
    member,
    status,
    view,
    issuedAt: (doc.issuedAt as Date).toISOString(),
    dueDate: dueDate.toISOString(),
    returnedAt: doc.returnedAt ? (doc.returnedAt as Date).toISOString() : null,
    renewCount: Number(doc.renewCount ?? 0),
    fineAmount: Number(doc.fineAmount ?? 0),
    notes: (doc.notes as string | null) ?? null,
    daysLeft,
    daysOverdue,
  };
}

/* -------------------------------------------------------------------------- */
/* Issue                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Issue a book to a member (business rule 1).
 *
 * Every rule is checked **inside** the transaction, so the member's loan count, the
 * book availability and the policy snapshot all describe the same moment. The copy
 * decrement itself is a single conditional update (`availableCopies > 0`), which is what
 * makes two simultaneous issues for the last copy safe: the loser's condition no longer
 * matches and it gets a clear conflict rather than driving the count negative.
 *
 * `memberId` comes from the request, which is the one documented exception to
 * "ownership is derived from the session" (invariant 3) — a librarian is naming a member
 * at the counter. The member is still role-checked, and a member calling this route never
 * reaches the service because the route requires staff.
 */
export async function issueLoan(input: IssueLoanInput, actor: Actor): Promise<LoanSummary> {
  const memberId = new Types.ObjectId(input.memberId);

  return withTransaction(async (session) => {
    const settings = await getSettings();
    const now = new Date();

    /* ------------------------------- Member ------------------------------- */
    const member = await User.findById(memberId).session(session).lean<UserDoc>();
    if (!member || member.role !== "member") {
      throw AppError.notFound("That member could not be found.");
    }

    if (member.status !== "active") {
      throw AppError.rule(
        `${member.name} is suspended and cannot borrow. Reinstate the account first.`,
        { memberId: "This member is suspended" },
      );
    }

    /* -------------------------------- Book -------------------------------- */
    // The desk has a barcode or a title, so accept an id **or** a slug.
    const bookFilter = Types.ObjectId.isValid(input.bookId)
      ? { _id: new Types.ObjectId(input.bookId) }
      : { slug: input.bookId.trim().toLowerCase() };

    const book = await Book.findOne(bookFilter).session(session).lean<BookDoc>();
    if (!book) throw AppError.notFound("That book could not be found.");

    const title = String(book.title);

    if (book.status !== "active") {
      throw AppError.rule(`“${title}” is archived, so it cannot be issued. Restore it first.`, {
        bookId: "This book is archived",
      });
    }

    /*
     * A copy set aside for a **ready** reservation is not available to anyone else
     * (business rule 1 / rule 6), so availability is
     * `availableCopies - holdsForOtherMembers`. The member's own hold is excluded,
     * because issuing is how they collect it.
     */
    const readyHolds = (await getReadyHoldCounts([book._id])).get(String(book._id)) ?? 0;
    const ownReadyHold = await Reservation.exists({
      book: book._id,
      member: memberId,
      status: "ready",
    }).session(session);

    const heldForOthers = Math.max(0, readyHolds - (ownReadyHold ? 1 : 0));

    if (!ownReadyHold && book.availableCopies - heldForOthers <= 0) {
      throw AppError.rule(
        heldForOthers > 0
          ? `Every copy of “${title}” is on hold for another member.`
          : `Every copy of “${title}” is on loan.`,
        { bookId: "No copies available" },
      );
    }

    /* ---------------------------- Policy limits ---------------------------- */
    const activeLoans = await Loan.countDocuments({ member: memberId, status: "active" }).session(
      session,
    );

    if (activeLoans >= settings.maxActiveLoans) {
      throw AppError.rule(
        `${member.name} already has ${activeLoans} ${activeLoans === 1 ? "book" : "books"} on loan. The limit is ${settings.maxActiveLoans}.`,
        { memberId: `The limit is ${settings.maxActiveLoans} books` },
      );
    }

    if (await Loan.exists({ member: memberId, book: book._id, status: "active" }).session(session)) {
      throw AppError.rule(`${member.name} already has “${title}” on loan. Return it before borrowing it again.`, {
        bookId: "Already on loan to this member",
      });
    }

    const [fineAgg] = await Fine.aggregate<{ total: number }>([
      { $match: { member: memberId, status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]).session(session);

    const owing = Math.round(fineAgg?.total ?? 0);
    if (owing > settings.fineBlockThreshold) {
      throw AppError.rule(
        `${member.name} owes ${settings.currencySymbol}${owing.toFixed(2)} in unpaid fines, which is over the ${settings.currencySymbol}${settings.fineBlockThreshold} limit. Settle the balance before borrowing again.`,
        { memberId: "Unpaid fines block new loans" },
      );
    }

    /* ----------------------- Take the copy (atomic) ----------------------- */
    /*
     * The conditional update is the concurrency guard. Two requests for the last copy
     * both pass the checks above, then race here — and only one matches
     * `availableCopies > 0`. It also bypasses the document validator, which is what we
     * want: the guard in the filter replaces it, and `availableCopies` cannot go negative
     * because Mongo refuses the whole update when the condition fails.
     */
    const taken = await Book.findOneAndUpdate(
      { _id: book._id, status: "active", availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1, borrowCount: 1 } },
      { session, new: true },
    ).lean<Record<string, unknown> | null>();

    if (!taken) {
      throw AppError.conflict(
        `The last copy of “${title}” was just issued to someone else. Try another title or check back shortly.`,
        { bookId: "No copies available" },
      );
    }

    /* ------------------------------ The loan ------------------------------ */
    const dueDate = addDays(now, settings.loanPeriodDays);

    const [created] = await Loan.create(
      [
        {
          book: book._id,
          member: memberId,
          issuedBy: actor.id,
          issuedAt: now,
          dueDate,
          renewCount: 0,
          status: "active",
          fineAmount: 0,
          notes: input.notes ?? null,
        },
      ],
      { session },
    );

    // Rule 1: issuing to a member with a ready hold *is* that hold being collected.
    const fulfilledHold = await fulfilReadyReservationIfAny(memberId, book._id, created._id, session);

    await logAudit({
      actor,
      action: "loan.issue",
      entityType: "Loan",
      entityId: created._id,
      summary: `Issued “${title}” to ${member.name}`,
      meta: {
        book: title,
        member: member.name,
        dueDate: dueDate.toISOString(),
        fulfilledHold,
      },
      session,
    });

    await notify({
      userId: memberId,
      type: "loan_issued",
      title: "Book issued",
      message: `“${title}” is due on ${format(dueDate, "d MMM yyyy")}.`,
      link: "/my-loans",
      session,
    });

    const [refs, members] = await Promise.all([bookRefs([book._id]), memberRefs([memberId])]);

    return toLoan(
      created.toObject() as Record<string, unknown>,
      bookRefOr(refs, book._id),
      memberRefOr(members, memberId),
      now,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* Return                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Take a book back (business rule 2).
 *
 * Everything happens in one transaction: the loan closes, the copy returns to the shelf,
 * a fine is raised if it was late, and the reservation queue is offered the freed copy.
 * Splitting those would let a member's hold be promoted against a copy that has not been
 * returned yet.
 *
 * The copy is restored with an `$expr` guard comparing `availableCopies` to
 * `totalCopies` **inside the update filter**. A `$lt` cannot compare two fields of the
 * same document, and doing the check in application code would reopen the race that
 * invariant 5 exists to close. If the guard fails the transaction aborts, so
 * `availableCopies` can never exceed `totalCopies` (invariant 5).
 */
export async function returnLoan(loanId: string, actor: Actor): Promise<LoanReturnResult> {
  return withTransaction(async (session) => {
    const loan = await Loan.findById(loanId).session(session);
    if (!loan) throw AppError.notFound("That loan could not be found.");

    const book = await Book.findById(loan.book).session(session).lean<BookDoc>();
    const title = book ? book.title : "a book";

    if (loan.status !== "active") {
      throw AppError.rule(
        `“${title}” was already returned on ${loan.returnedAt ? format(loan.returnedAt, "d MMM yyyy") : "an earlier date"}.`,
      );
    }

    const now = new Date();
    const { daysOverdue } = deriveLoanState({ status: loan.status, dueDate: loan.dueDate }, now);

    loan.status = "returned";
    loan.returnedAt = now;
    loan.receivedBy = actor.id;
    await loan.save({ session });

    const restored = await Book.findOneAndUpdate(
      { _id: loan.book, $expr: { $lt: ["$availableCopies", "$totalCopies"] } },
      { $inc: { availableCopies: 1 } },
      { session, new: true },
    ).lean<Record<string, unknown> | null>();

    if (!restored) {
      throw AppError.rule(
        `“${title}” already shows every copy as available, so the return was not recorded. Check the shelf count.`,
      );
    }

    // Unit 13 owns the money; the lateness is computed here so the two cannot disagree.
    const fine = await createFineIfLate(
      {
        _id: loan._id,
        member: loan.member,
        book: loan.book,
        dueDate: loan.dueDate,
      },
      now,
      session,
    );

    // A returned copy is the only event that can make a waiting hold ready (rule 6).
    await promoteReservationQueue(loan.book, session);

    const late = daysOverdue > 0;

    await logAudit({
      actor,
      action: "loan.return",
      entityType: "Loan",
      entityId: loan._id,
      summary: late
        ? `Returned “${title}” ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} late`
        : `Returned “${title}” on time`,
      meta: { book: title, daysOverdue, late },
      session,
    });

    if (late) {
      await notify({
        userId: loan.member,
        type: "overdue",
        title: "Book returned late",
        message: `“${title}” was returned ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} after its due date.`,
        link: "/fines",
        session,
      });
    } else {
      await notify({
        userId: loan.member,
        type: "loan_returned",
        title: "Book returned",
        message: `Thanks for returning “${title}”.`,
        link: "/my-loans",
        session,
      });
    }

    const [refs, members] = await Promise.all([
      bookRefs([loan.book]),
      memberRefs([loan.member]),
    ]);

    return {
      loan: toLoan(
        loan.toObject() as Record<string, unknown>,
        bookRefOr(refs, loan.book),
        memberRefOr(members, loan.member),
        now,
      ),
      fine,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Renew                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Extend a loan by `renewalExtensionDays` (business rule 3).
 *
 * A member may renew **their own** loan and nothing else (invariant 3); staff may renew
 * anyone's. The four refusals are each worth a sentence a member can act on, because
 * "renewal denied" with no reason is the complaint this screen generates.
 */
export async function renewLoan(loanId: string, actor: Actor): Promise<LoanSummary> {
  return withTransaction(async (session) => {
    const loan = await Loan.findById(loanId).session(session);
    if (!loan) throw AppError.notFound("That loan could not be found.");

    const book = await Book.findById(loan.book).session(session).lean<BookDoc>();
    const title = book ? book.title : "this book";

    if (loan.status !== "active") {
      throw AppError.rule(`“${title}” has already been returned, so it cannot be renewed.`);
    }

    if (!isStaff(actor.role) && String(loan.member) !== String(actor.id)) {
      throw AppError.forbidden("You can only renew your own loans.");
    }

    const member = await User.findById(loan.member).session(session).lean<UserDoc>();
    const memberName = member ? member.name : "This member";

    if (!member) throw AppError.notFound("That member could not be found.");
    if (member.status !== "active") {
      throw AppError.rule(`${memberName} is suspended, so this loan cannot be renewed.`);
    }

    const settings = await getSettings();
    const now = new Date();

    const { view, daysLeft } = deriveLoanState({ status: loan.status, dueDate: loan.dueDate }, now);

    if (view === "overdue" || daysLeft < 0) {
      throw AppError.rule(
        `“${title}” is overdue, so it cannot be renewed. Return it and settle any fine first.`,
      );
    }

    if (loan.renewCount >= settings.maxRenewals) {
      throw AppError.rule(
        `“${title}” has already been renewed ${loan.renewCount} ${loan.renewCount === 1 ? "time" : "times"}. The limit is ${settings.maxRenewals}.`,
      );
    }

    // Real count, not a stub — see `countOtherReservations`. Their own hold must not
    // block their own renewal, hence the member exclusion.
    const waiting = await countOtherReservations(loan.book, loan.member, session);
    if (waiting > 0) {
      throw AppError.rule(
        `${waiting} ${waiting === 1 ? "member is" : "members are"} waiting for “${title}”, so it cannot be renewed.`,
      );
    }

    const previousDue = loan.dueDate;
    const newDue = addDays(previousDue, settings.renewalExtensionDays);

    loan.dueDate = newDue;
    loan.renewCount += 1;
    await loan.save({ session });

    await logAudit({
      actor,
      action: "loan.renew",
      entityType: "Loan",
      entityId: loan._id,
      summary: `Renewed “${title}” for ${memberName}`,
      meta: {
        book: title,
        member: memberName,
        renewCount: loan.renewCount,
        previousDue: previousDue.toISOString(),
        newDue: newDue.toISOString(),
      },
      session,
    });

    await notify({
      userId: loan.member,
      type: "loan_renewed",
      title: "Loan renewed",
      message: `“${title}” is now due on ${format(newDue, "d MMM yyyy")}.`,
      link: "/my-loans",
      session,
    });

    const [refs, members] = await Promise.all([
      bookRefs([loan.book]),
      memberRefs([loan.member]),
    ]);

    return toLoan(
      loan.toObject() as Record<string, unknown>,
      bookRefOr(refs, loan.book),
      memberRefOr(members, loan.member),
      now,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* List                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Build the Mongo filter for a derived `LOAN_VIEWS` value.
 *
 * `overdue` and `due_soon` are **not stored states**, so they become range predicates on
 * `dueDate` bounded by calendar-day edges — the same `differenceInCalendarDays`
 * arithmetic `deriveLoanState` uses. Using `startOfDay`/`endOfDay` here and
 * `differenceInCalendarDays` there keeps the filter and the badge in agreement; mixing
 * `new Date()` with one and midnight with the other is how a loan ends up listed under
 * "overdue" with a "0 days" badge.
 */
function viewFilter(view: string, now: Date): Record<string, unknown> | null {
  const today = startOfDay(now);

  switch (view) {
    case "returned":
      return { status: "returned" };
    case "active":
      return { status: "active" };
    case "overdue":
      return { status: "active", dueDate: { $lt: today } };
    case "due_soon":
      return {
        status: "active",
        dueDate: { $gte: today, $lte: endOfDay(addDays(now, DUE_SOON_DAYS)) },
      };
    default:
      return null;
  }
}

/** `active` queues are read by urgency; everything else by recency. */
function sortFor(view: string | undefined): Record<string, 1 | -1> {
  if (!view || view === "returned") return { returnedAt: -1, _id: -1 };
  return { dueDate: 1, _id: 1 };
}

/**
 * Free-text search across the member and the book.
 *
 * Resolved to id lists **first** and then applied as `$or`. A `$lookup` inside `find()`
 * cannot be followed by the `skip`/`limit` Mongo needs to paginate correctly, and a
 * regex against a joined field would silently ignore `page`. Two cheap indexed lookups
 * keep the count and the page honest.
 */
async function searchIds(q: string): Promise<{ members: Types.ObjectId[]; books: Types.ObjectId[] }> {
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const [members, books] = await Promise.all([
    User.find({ role: "member", $or: [{ name: rx }, { email: rx }, { membershipId: rx }] })
      .select("_id")
      .limit(200)
      .lean<Array<{ _id: Types.ObjectId }>>(),
    Book.find({ $or: [{ title: rx }, { isbn: rx }] })
      .select("_id")
      .limit(200)
      .lean<Array<{ _id: Types.ObjectId }>>(),
  ]);

  return {
    members: members.map((m) => m._id),
    books: books.map((b) => b._id),
  };
}

/**
 * The staff loan table (F7).
 *
 * `view` is optional, so "no filter" means *all* loans rather than silently hiding
 * returned ones — the desk opens on everything and then narrows.
 */
export async function listLoans(query: ListLoansQuery): Promise<{
  items: LoanSummary[];
  meta: PageMeta;
}> {
  const now = new Date();
  // **`await` is load-bearing.** `buildFilter` is async because the free-text branch has
  // to await two id lookups. Without this await a `Promise` reaches `find()`, and
  // Mongoose reports it as:
  //   ObjectParameterError: Parameter "filter" to find() must be an object,
  //   got "[object Promise]"
  // which surfaces as a bare 500 on every loan tab. `tsc` and `eslint` both accept it,
  // because Mongoose's filter parameter is typed loosely enough to swallow a Promise.
  const filter = await buildFilter(query, now);

  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Loan.countDocuments(filter),
    Loan.find(filter)
      .sort(sortFor(query.status))
      .skip(skip)
      .limit(limit)
      .lean<Array<Record<string, unknown>>>(),
  ]);

  const [refs, members] = await Promise.all([
    bookRefs(docs.map((doc) => doc.book)),
    memberRefs(docs.map((doc) => doc.member)),
  ]);

  return {
    items: docs.map((doc) =>
      toLoan(doc, bookRefOr(refs, doc.book), memberRefOr(members, doc.member), now),
    ),
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

/** A member's own loans. No `memberId` — it comes from the session (invariant 3). */
export async function listMyLoans(
  memberId: Types.ObjectId,
  query: ListMyLoansQuery,
): Promise<{ items: LoanSummary[]; meta: PageMeta }> {
  const now = new Date();
  const view = query.status ? viewFilter(query.status, now) : null;

  const filter: Record<string, unknown> = { member: memberId, ...(view ?? {}) };
  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  const skip = (page - 1) * limit;

  const [total, docs] = await Promise.all([
    Loan.countDocuments(filter),
    Loan.find(filter)
      .sort(sortFor(query.status))
      .skip(skip)
      .limit(limit)
      .lean<Array<Record<string, unknown>>>(),
  ]);

  const [refs, members] = await Promise.all([
    bookRefs(docs.map((doc) => doc.book)),
    memberRefs(docs.map((doc) => doc.member)),
  ]);

  return {
    items: docs.map((doc) =>
      toLoan(doc, bookRefOr(refs, doc.book), memberRefOr(members, doc.member), now),
    ),
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

async function buildFilter(query: ListLoansQuery, now: Date): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {};

  const view = query.status ? viewFilter(query.status, now) : null;
  if (view) Object.assign(filter, view);

  if (query.memberId) filter.member = new Types.ObjectId(query.memberId);
  if (query.bookId) filter.book = new Types.ObjectId(query.bookId);

  if (query.from || query.to) {
    const issuedAt: Record<string, Date> = {};
    // `to` is inclusive of the whole day, so it extends to the last millisecond of it.
    if (query.from) issuedAt.$gte = startOfDay(new Date(`${query.from}T00:00:00`));
    if (query.to) issuedAt.$lte = endOfDay(new Date(`${query.to}T00:00:00`));
    filter.issuedAt = issuedAt;
  }

  if (query.q) {
    const { members, books } = await searchIds(query.q);
    // An empty result set must match nothing rather than everything, which is what an
    // `$or` of two empty arrays does.
    filter.$or = [{ member: { $in: members } }, { book: { $in: books } }];
  }

  return filter;
}

export type { FineStatus, LoanFineRef };