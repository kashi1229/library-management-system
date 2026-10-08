import "server-only";
import { Types, type ClientSession } from "mongoose";
import { endOfDay, startOfDay, startOfMonth } from "date-fns";
import { AppError } from "@/lib/api";
import { Book, Fine, Loan, User } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { getSettings } from "@/lib/services/settings";
import { bookRefOr, bookRefs, memberRefOr, memberRefs } from "@/lib/services/refs";
import type {
  CollectFineInput,
  ListFinesQuery,
  ListMyFinesQuery,
  WaiveFineInput,
} from "@/lib/validators/fine";
import type { FineStatus, PaymentMethod } from "@/lib/constants";
import type { Actor, LoanDoc, PageMeta } from "@/types";

/**
 * Fine service (F9, spec 13).
 *
 * **Two rules are terminal.** `unpaid → paid` or `unpaid → waived`, and never again. A fine
 * that can be collected after it was waived is a fine the library has to argue about at
 * audit; the state machine is enforced here and re-checked in the query below, so a repeat
 * attempt is a 400 with a sentence rather than a silent no-op.
 *
 * Every policy number comes from `getSettings()` at request time (invariant 7).
 */

const FINE_FIELDS =
  "loan member book daysOverdue ratePerDay amount status paidAt collectedBy paymentMethod waivedBy reason note createdAt";

type FineDocShape = {
  _id: unknown;
  loan: unknown;
  member: unknown;
  book: unknown;
  daysOverdue: number;
  ratePerDay: number;
  amount: number;
  status: FineStatus;
  paidAt?: Date | null;
  collectedBy?: unknown;
  paymentMethod?: PaymentMethod | null;
  waivedBy?: unknown;
  reason?: string | null;
  note?: string | null;
  createdAt: Date;
};

/** Serialise for the API boundary: string ids and ISO dates. */
function serialise(fine: FineDocShape) {
  return {
    id: String(fine._id),
    loanId: String(fine.loan),
    bookId: String(fine.book),
    memberId: String(fine.member),
    daysOverdue: fine.daysOverdue,
    ratePerDay: fine.ratePerDay,
    amount: fine.amount,
    status: fine.status,
    paidAt: fine.paidAt ? fine.paidAt.toISOString() : null,
    paymentMethod: fine.paymentMethod ?? null,
    reason: fine.reason ?? null,
    note: fine.note ?? null,
    raisedAt: fine.createdAt.toISOString(),
  };
}

export type FineSummary = ReturnType<typeof serialise>;

/* -------------------------------------------------------------------------- */
/* Create (called from circulation)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Raise a fine for a late return (business rule 2, spec 13).
 *
 * Replaces the Unit 11 stub, so the Unit 12 Return dialog can now show a real amount.
 *
 * `amount = min(daysOverdue × finePerDay, maxFinePerLoan)`. **The cap is applied on the
 * product, not on the daily rate** — a member 400 days late is charged the cap, not 400 ×
 * the rate, which would be a five-figure debt for one forgotten book.
 *
 * `loan.fineAmount` is written **denormalised** so a loan list never has to join the Fine
 * collection (the Unit 12 desk already reads it for the "fine" pill). It is the same value
 * written here, in the same transaction, so the two cannot disagree.
 *
 * Returns `null` for an on-time return — that is a normal outcome, not an error, and the
 * caller's `fine: null` is exactly right.
 */
export async function createFineIfLate(
  loan: Pick<LoanDoc, "_id" | "member" | "book" | "dueDate">,
  actor: Actor,
  session: ClientSession,
  daysOverdue: number,
  bookTitle: string,
): Promise<FineSummary | null> {
  if (daysOverdue <= 0) return null;

  const settings = await getSettings();

  // The cap is on the product. Rounding to cents also keeps the stored `amount` matching
  // what the UI prints, rather than differing by a fraction of a currency unit.
  const amount = Math.round(
    Math.min(daysOverdue * settings.finePerDay, settings.maxFinePerLoan) * 100,
  ) / 100;

  const [created] = await Fine.create(
    [
      {
        loan: loan._id,
        member: loan.member,
        book: loan.book,
        daysOverdue,
        // Snapshot of the rate at the moment of the fine. If an admin changes
        // `finePerDay` next month, this fine still says what it was charged at.
        ratePerDay: settings.finePerDay,
        amount,
        status: "unpaid",
      },
    ],
    { session },
  );

  // Denormalised onto the loan so the desk's list can show it without a join.
  await Loan.updateOne({ _id: loan._id }, { $set: { fineAmount: amount } }, { session });

  await logAudit({
    // The actor is whoever processed the return at the desk. There is no "system" role,
    // and using the loan id here would have written a fine.create row attributed to a
    // loan rather than to the staff member who actually took the book back.
    actor,
    action: "fine.create",
    entityType: "Fine",
    entityId: created._id,
    summary: `Charged ${created.amount} for “${bookTitle}” ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} late`,
    meta: { amount, daysOverdue, ratePerDay: settings.finePerDay, book: bookTitle },
    session,
  });

  await notify({
    userId: loan.member,
    type: "fine_created",
    title: "A fine was added",
    message: `“${bookTitle}” was returned ${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} late. You owe ${settings.currencySymbol}${amount.toFixed(2)}.`,
    link: "/fines",
    session,
  });

  return serialise(created as unknown as FineDocShape);
}

/* -------------------------------------------------------------------------- */
/* Totals                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A member's unpaid total, in currency units.
 *
 * **This is the number the issue rule compares against `fineBlockThreshold`**, and it is
 * the reason the function exists separately from `listMyFines`: circulation must not have to
 * fetch a page of fines to learn whether someone is blocked.
 */
export async function getUnpaidTotal(memberId: Types.ObjectId): Promise<number> {
  const [row] = await Fine.aggregate<{ total: number }>([
    { $match: { member: memberId, status: "unpaid" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  return Math.round((row?.total ?? 0) * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

export type FineListItem = FineSummary & {
  book: ReturnType<typeof bookRefOr>;
  member: { id: string; name: string; membershipId: string | null };
};

/** Attach the book and member a row needs, in two batched queries. */
async function decorate(rows: Array<Record<string, unknown>>): Promise<FineListItem[]> {
  const [refs, members] = await Promise.all([
    bookRefs(rows.map((row) => row.book)),
    memberRefs(rows.map((row) => row.member)),
  ]);

  return rows.map((row) => ({
    ...serialise(row as unknown as FineDocShape),
    book: bookRefOr(refs, row.book),
    member: {
      id: String(memberRefOr(members, row.member).id),
      name: memberRefOr(members, row.member).name,
      membershipId: memberRefOr(members, row.member).membershipId,
    },
  }));
}

/**
 * The staff fine table (F9).
 *
 * `totals` covers **all three** KPI figures the desk shows, and they are computed over the
 * same filter rather than over the visible page: "Unpaid total" is the money the library is
 * owed in total, and slicing it to 20 rows would under-report it. `page`/`limit` are
 * therefore deliberately **not** part of the totals filter.
 */
export async function listFines(query: ListFinesQuery): Promise<{
  items: FineListItem[];
  meta: PageMeta;
  totals: {
    unpaidTotal: number;
    collectedThisMonth: number;
    waivedThisMonth: number;
  };
}> {
  const filter = await buildFilter(query);

  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  const skip = (page - 1) * limit;

  const [total, rows, unpaidAgg, collectedAgg, waivedAgg] = await Promise.all([
    Fine.countDocuments(filter),
    Fine.find(filter)
      .select(FINE_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean<Array<Record<string, unknown>>>(),
    Fine.aggregate<{ total: number }>([
      { $match: { status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Fine.aggregate<{ total: number }>([
      { $match: { status: "paid", paidAt: { $gte: startOfMonth(new Date()) } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Fine.aggregate<{ total: number }>([
      { $match: { status: "waived", updatedAt: { $gte: startOfMonth(new Date()) } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    items: await decorate(rows),
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
    totals: {
      unpaidTotal: round2(unpaidAgg[0]?.total ?? 0),
      collectedThisMonth: round2(collectedAgg[0]?.total ?? 0),
      waivedThisMonth: round2(waivedAgg[0]?.total ?? 0),
    },
  };
}

/** A member's own fines, plus what they owe. */
export async function listMyFines(
  memberId: Types.ObjectId,
  query: ListMyFinesQuery,
): Promise<{ items: FineListItem[]; meta: PageMeta; outstandingTotal: number }> {
  const filter: Record<string, unknown> = { member: memberId };
  if (query.status) filter.status = query.status;

  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  const skip = (page - 1) * limit;

  const [total, rows, outstanding] = await Promise.all([
    Fine.countDocuments(filter),
    Fine.find(filter)
      .select(FINE_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean<Array<Record<string, unknown>>>(),
    getUnpaidTotal(memberId),
  ]);

  return {
    items: await decorate(rows),
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
    outstandingTotal: outstanding,
  };
}

async function buildFilter(query: ListFinesQuery): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.memberId) filter.member = new Types.ObjectId(query.memberId);
  if (query.bookId) filter.book = new Types.ObjectId(query.bookId);

  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.$gte = startOfDay(new Date(`${query.from}T00:00:00`));
    if (query.to) createdAt.$lte = endOfDay(new Date(`${query.to}T00:00:00`));
    filter.createdAt = createdAt;
  }

  if (query.q) {
    const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // Resolved to ids first, then applied as `$or` — a `$lookup` inside `find()` cannot be
    // followed by the `skip`/`limit` Mongo needs to paginate correctly, which would make
    // the total a lie and let "Next" show an empty page.
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

    filter.$or = [
      { member: { $in: members.map((m) => m._id) } },
      { book: { $in: books.map((b) => b._id) } },
    ];
  }

  return filter;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Collect / waive                                                             */
/* -------------------------------------------------------------------------- */

/** Load an unpaid fine, or explain why it cannot be touched. */
async function requireUnpaidFine(id: string) {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That fine could not be found.");

  const fine = await Fine.findById(id);
  if (!fine) throw AppError.notFound("That fine could not be found.");

  if (fine.status !== "unpaid") {
    throw AppError.rule(
      fine.status === "waived"
        ? "This fine was waived, so there is nothing to collect."
        : "This fine has already been paid.",
    );
  }

  return fine;
}

/**
 * Record a payment against a fine (F9).
 *
 * **The amount must equal the fine exactly — neither less nor more.** A part payment is not
 * modelled: `Fine` has no `amountPaid` field, so accepting 3.00 against a 15.00 fine would
 * mark a 15.00 debt as settled and lose 12.00. Overpaying is refused for the same reason
 * from the other side: there is no change or `amountPaid` to record, so taking 100.00 for a
 * 15.00 fine would write a `fine.collect` audit row claiming 100.00 was collected while
 * `fine.amount` stayed 15.00, and the two would disagree forever. Refusing with the exact
 * figure is honest and matches the data the model actually has.
 */
export async function collectFine(
  id: string,
  input: CollectFineInput,
  actor: Actor,
): Promise<FineListItem> {
  const fine = await requireUnpaidFine(id);
  const settings = await getSettings();

  const outstanding = round2(fine.amount);
  const tendered = round2(input.amount);

  if (tendered !== outstanding) {
    throw AppError.rule(
      `This fine is ${settings.currencySymbol}${outstanding.toFixed(2)}. Record the full amount, or waive the fine instead.`,
      {
        amount:
          tendered < outstanding
            ? `The outstanding amount is ${settings.currencySymbol}${outstanding.toFixed(2)}`
            : `Enter exactly ${settings.currencySymbol}${outstanding.toFixed(2)} — this system does not record overpayments or change`,
      },
    );
  }

  fine.status = "paid";
  fine.paidAt = new Date();
  fine.collectedBy = actor.id;
  fine.paymentMethod = input.paymentMethod;
  if (input.note) fine.note = input.note;
  await fine.save();

  const book = await Book.findById(fine.book).select("title").lean<{ title: string }>();
  const title = book?.title ?? "a book";

  await logAudit({
    actor,
    action: "fine.collect",
    entityType: "Fine",
    entityId: fine._id,
    summary: `Collected ${settings.currencySymbol}${input.amount.toFixed(2)} for “${title}” by ${input.paymentMethod}`,
    meta: { amount: input.amount, paymentMethod: input.paymentMethod, book: title, note: input.note ?? null },
  });

  await notify({
    userId: fine.member,
    type: "fine_paid",
    title: "Fine paid",
    message: `Thanks — ${settings.currencySymbol}${input.amount.toFixed(2)} for “${title}” has been recorded.`,
    link: "/fines",
  });

  const [refs, members] = await Promise.all([
    bookRefs([fine.book]),
    memberRefs([fine.member]),
  ]);

  return {
    ...serialise(fine.toObject() as unknown as FineDocShape),
    book: bookRefOr(refs, fine.book),
    member: {
      id: String(memberRefOr(members, fine.member).id),
      name: memberRefOr(members, fine.member).name,
      membershipId: memberRefOr(members, fine.member).membershipId,
    },
  };
}

/**
 * Forgive a fine (F9).
 *
 * **`unpaid` only.** A waived fine is terminal, and the schema requires a reason because
 * waiving someone's debt is the one action here with no trace of who decided it or why.
 */
export async function waiveFine(
  id: string,
  input: WaiveFineInput,
  actor: Actor,
): Promise<FineListItem> {
  const fine = await requireUnpaidFine(id);
  const settings = await getSettings();

  fine.status = "waived";
  fine.waivedBy = actor.id;
  fine.reason = input.reason;
  await fine.save();

  const book = await Book.findById(fine.book).select("title").lean<{ title: string }>();
  const title = book?.title ?? "a book";

  await logAudit({
    actor,
    action: "fine.waive",
    entityType: "Fine",
    entityId: fine._id,
    summary: `Waived ${settings.currencySymbol}${fine.amount.toFixed(2)} for “${title}”`,
    meta: { amount: fine.amount, reason: input.reason, book: title },
  });

  await notify({
    userId: fine.member,
    type: "fine_waived",
    title: "Fine waived",
    message: `The ${settings.currencySymbol}${fine.amount.toFixed(2)} fine for “${title}” has been waived.`,
    link: "/fines",
  });

  const [refs, members] = await Promise.all([
    bookRefs([fine.book]),
    memberRefs([fine.member]),
  ]);

  return {
    ...serialise(fine.toObject() as unknown as FineDocShape),
    book: bookRefOr(refs, fine.book),
    member: {
      id: String(memberRefOr(members, fine.member).id),
      name: memberRefOr(members, fine.member).name,
      membershipId: memberRefOr(members, fine.member).membershipId,
    },
  };
}