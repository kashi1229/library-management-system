import "server-only";
import type { Types } from "mongoose";
import { format, startOfDay } from "date-fns";
import { Book, Category, Fine, Loan, Reservation } from "@/models";
import { formatCurrency } from "@/lib/utils";
import { getSettings } from "@/lib/services/settings";
import type { ReportQuery } from "@/lib/validators/report";
import type { ReportColumn, ReportResult, ReportRow, ReportSummaryItem } from "@/types";
import type { ReportType } from "@/lib/constants";

/**
 * Six staff reports (spec 18).
 *
 * **Every figure is computed in Mongo, never in the browser.** A borrowing report over a year is
 * tens of thousands of documents; pulling them over the wire to count them in a loop is the same
 * mistake the Unit 17 dashboard avoided, and this file is where it would be easiest to repeat.
 *
 * **One return shape for six reports.** `{ summary, columns, rows, meta }` is what the spec asks
 * for and it is why `ReportTable` is one component: `columns` *is* the schema, so a row that is
 * missing a key renders an em dash instead of throwing, and a seventh report needs no new table.
 *
 * **The summary must equal the sum of the rows** — that is the spec's own first check, and it is
 * the one that catches a report whose filters were applied to the summary and not to the rows, or
 * vice versa. Where a summary is a total rather than a count, it is computed from the same
 * aggregation `$group` that produces the rows rather than from a second query.
 *
 * **`overdue` is derived, never stored** (invariant 4). Every "is this late" question goes
 * through the same calendar-day comparison the loan lists use, so a report and a loan row cannot
 * disagree about the same book.
 */

/* -------------------------------------------------------------------------- */
/* Shared plumbing                                                             */
/* -------------------------------------------------------------------------- */

/** Inclusive `YYYY-MM-DD` bounds resolved to real `Date`s, plus the echoes for the UI. */
function resolveRange(query: ReportQuery): { from: Date | null; to: Date | null } {
  // `+T00:00:00Z` rather than `new Date("2026-08-12")`, which parses as UTC midnight in a modern
  // engine but as *local* midnight in older ones — the same trap as `new Date("2026-10-08")` in
  // the dashboard's date axis, and the reason this is written out rather than `parseISO`'d.
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
  // `to` is inclusive, so the upper bound is the *end* of that day, not its start.
  const to = query.to ? new Date(`${query.to}T23:59:59.999Z`) : null;
  return { from, to };
}

/** A `Date` field must match `[from, to]`, inclusive; either end may be open. */
function dateWindow(from: Date | null, to: Date | null, field = "issuedAt"): Record<string, unknown> {
  if (!from && !to) return {};
  if (from && to) return { [field]: { $gte: from, $lte: to } };
  return { [field]: from ? { $gte: from } : { $lte: to! } };
}

/**
 * Category narrowing, as a `$lookup`-free filter where possible.
 *
 * `categoryId` narrows the *books* a report is about, so most reports have to resolve it to a set
 * of book ids first. `categoryBookIds` is the single place that happens — a second implementation
 * somewhere else would be a filter that looks the same and silently matches nothing.
 */
async function categoryBookIds(categoryId?: string): Promise<Types.ObjectId[] | null> {
  if (!categoryId) return null;
  const books = await Book.find({ category: categoryId }).select("_id").lean<Array<{ _id: Types.ObjectId }>>();
  return books.map((book) => book._id);
}

/**
 * Sort in the database, then paginate.
 *
 * **The order matters and is the reason sorting lives in the service at all.** Sorting a page in
 * the browser after a limit has been applied orders one page correctly and then splices the next
 * page's rows into the wrong places — so "sort by fine, descending" would put the largest fine on
 * page four.
 *
 * An unknown key falls back to the report's natural order rather than raising a 422: the sort
 * key travels in a URL a person can edit, and a stale link should still show the report.
 */
function sortRows<T extends ReportRow>(rows: T[], key: string | undefined, dir: "asc" | "desc"): T[] {
  if (!key || !(key in (rows[0] ?? {}))) return rows;

  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a[key];
    const right = b[key];

    // Numbers compare numerically; everything else compares as text, with an empty cell last in
    // either direction rather than sorting as "" to the top of a descending list.
    if (typeof left === "number" && typeof right === "number") return (left - right) * sign;

    const l = left === null || left === "" ? null : String(left);
    const r = right === null || right === "" ? null : String(right);
    if (l === null && r === null) return 0;
    if (l === null) return 1;
    if (r === null) return -1;
    return l.localeCompare(r, "en") * sign;
  });
}

/** Page a sorted array and report the totals around it. */
function paginate<T>(rows: T[], page: number, limit: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return { paged: rows.slice(start, start + limit), total, page, limit, totalPages };
}

/** One consistent shape for the six titles and descriptions. */
const REPORT_META: Record<ReportType, { title: string; description: string }> = {
  borrowing: { title: "Borrowing history", description: "Every loan issued in the period, with what it cost and whether it came back." },
  overdue: { title: "Overdue loans", description: "Active loans past their due date, and what they would cost if collected now." },
  popular: { title: "Popular books", description: "Titles ranked by how often they went out in the period." },
  members: { title: "Member activity", description: "Members ranked by borrowing in the period, with what they currently owe." },
  fines: { title: "Fines", description: "Fines raised in the period, and how each one was settled." },
  inventory: { title: "Inventory", description: "Every active title, with what is on the shelf, out on loan, and held for somebody." },
};

export const REPORT_TITLES = REPORT_META;

/* -------------------------------------------------------------------------- */
/* Entry point                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Build one report.
 *
 * **The six builders are independent and run in parallel behind one door.** They share the range
 * resolution and the pagination, not any state, so a change to the inventory report cannot alter
 * the fines report — which is the reason they are six functions and not one with a `switch` and
 * six accumulators.
 */
export async function getReport(type: ReportType, query: ReportQuery): Promise<ReportResult> {
  const { from, to } = resolveRange(query);
  const bookIds = await categoryBookIds(query.categoryId);
  const ctx = { from, to, bookIds, now: new Date(), query };

  let summary: ReportSummaryItem[];
  let columns: ReportColumn[];
  let allRows: ReportRow[];

  switch (type) {
    case "borrowing": {
      const built = await borrowingReport(ctx);
      ({ summary, columns, allRows } = built);
      break;
    }
    case "overdue": {
      const built = await overdueReport(ctx);
      ({ summary, columns, allRows } = built);
      break;
    }
    case "popular": {
      const built = await popularReport(ctx);
      ({ summary, columns, allRows } = built);
      break;
    }
    case "members": {
      const built = await membersReport(ctx);
      ({ summary, columns, allRows } = built);
      break;
    }
    case "fines": {
      const built = await finesReport(ctx);
      ({ summary, columns, allRows } = built);
      break;
    }
    case "inventory": {
      const built = await inventoryReport(ctx);
      ({ summary, columns, allRows } = built);
      break;
    }
  }

  const sorted = sortRows(allRows, query.sort, query.dir);
  const page = paginate(sorted, query.page, query.limit);

  return {
    type,
    ...REPORT_META[type],
    summary,
    columns,
    rows: page.paged,
    total: page.total,
    page: page.page,
    limit: page.limit,
    totalPages: page.totalPages,
    range: { from: query.from ?? null, to: query.to ?? null },
  };
}

type ReportContext = {
  from: Date | null;
  to: Date | null;
  bookIds: Types.ObjectId[] | null;
  now: Date;
  query: ReportQuery;
};

/* -------------------------------------------------------------------------- */
/* 1. Borrowing history                                                        */
/* -------------------------------------------------------------------------- */

async function borrowingReport(ctx: ReportContext) {
  const { from, to, bookIds, now } = ctx;

  // One `$lookup` each for the book and the member, then the derived state computed *in the
  // pipeline* so the "returned / still out" figure and the rows cannot come from two different
  // questions. `overdue` is a calendar-day comparison, matching `deriveLoanState` (invariant 12).
  const raw = await Loan.aggregate<{
      _id: Types.ObjectId;
      issuedAt: Date;
      dueDate: Date;
      returnedAt: Date | null;
      fineAmount: number;
      status: string;
      /** Added by `$addFields`; declared here because TypeScript does not read the pipeline. */
      daysOverdue: number;
      book: { _id: Types.ObjectId; title: string; slug: string } | null;
      member: { _id: Types.ObjectId; name: string; membershipId: string | null } | null;
    }>([
    { $match: { ...dateWindow(from, to), ...(bookIds ? { book: { $in: bookIds } } : {}) } },
    {
      $lookup: {
        from: "books",
        localField: "book",
        foreignField: "_id",
        as: "book",
        pipeline: [{ $project: { title: 1, slug: 1 } }],
      },
    },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "member",
        foreignField: "_id",
        as: "member",
        pipeline: [{ $project: { name: 1, membershipId: 1 } }],
      },
    },
    { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        // Overdue is derived, never stored (invariant 4). `startOfDay` on the *server's* clock
        // matches what the loan lists report, so a report and a row cannot disagree.
        daysOverdue: {
          $cond: [
            { $and: [{ $eq: ["$status", "active"] }, { $lt: ["$dueDate", startOfDay(now)] }] },
            {
              $dateDiff: {
                startDate: { $dateTrunc: { date: startOfDay(now), unit: "day" } },
                endDate: { $dateTrunc: { date: "$dueDate", unit: "day" } },
                unit: "day",
              },
            },
            0,
          ],
        },
      },
    },
    { $sort: { issuedAt: -1, _id: 1 } },
  ]);

  const rows: ReportRow[] = raw.map((loan) => {
    const isActive = loan.status === "active";
    return {
      id: String(loan._id),
      book: loan.book?.title ?? "Unknown title",
      member: loan.member?.name ?? "Unknown member",
      membershipId: loan.member?.membershipId ?? "—",
      issued: format(loan.issuedAt, "d MMM yyyy"),
      due: format(loan.dueDate, "d MMM yyyy"),
      returned: loan.returnedAt ? format(loan.returnedAt, "d MMM yyyy") : "—",
      state: isActive ? "On loan" : "Returned",
      daysOverdue: loan.daysOverdue ?? 0,
      fine: formatCurrency(loan.fineAmount ?? 0),
      fineValue: loan.fineAmount ?? 0,
    };
  });

  const returned = rows.filter((row) => row.state === "Returned").length;
  const late = rows.filter((row) => (row.daysOverdue as number) > 0).length;
  const fines = rows.reduce((sum, row) => sum + (row.fineValue as number), 0);

  return {
    summary: [
      { label: "Loans issued", value: rows.length.toLocaleString("en-US") },
      { label: "Returned", value: returned.toLocaleString("en-US") },
      {
        label: "Overdue",
        value: late.toLocaleString("en-US"),
        tone: late > 0 ? ("danger" as const) : ("success" as const),
      },
      { label: "Fines raised", value: formatCurrency(fines) },
    ],
    columns: [
      { key: "book", label: "Book", emphasis: true },
      { key: "member", label: "Member" },
      { key: "membershipId", label: "Membership ID" },
      { key: "issued", label: "Issued" },
      { key: "due", label: "Due" },
      { key: "returned", label: "Returned" },
      { key: "state", label: "State" },
      { key: "daysOverdue", label: "Days late", align: "right" },
      { key: "fine", label: "Fine", align: "right" },
    ] satisfies ReportColumn[],
    allRows: rows,
  };
}

/* -------------------------------------------------------------------------- */
/* 2. Overdue loans                                                            */
/* -------------------------------------------------------------------------- */

async function overdueReport(ctx: ReportContext) {
  const { bookIds, now } = ctx;

  // **`finePerDay` is read from the Settings singleton, never hard-coded** (invariant 7). The
  // "potential fine" column is a hypothetical, not a charge — nothing is written — and it is still
  // wrong the moment an admin changes the rate.
  const settings = await getSettings().catch(() => null);
  const ratePerDay = settings?.finePerDay ?? 0;
  const cap = settings?.maxFinePerLoan ?? 0;

  const raw = await Loan.aggregate<{
      _id: Types.ObjectId;
      dueDate: Date;
      /** Added by `$addFields`; declared here because TypeScript does not read the pipeline. */
      daysOverdue: number;
      book: { _id: Types.ObjectId; title: string } | null;
      member: { _id: Types.ObjectId; name: string; membershipId: string | null } | null;
    }>([
    { $match: { status: "active", dueDate: { $lt: startOfDay(now) }, ...(bookIds ? { book: { $in: bookIds } } : {}) } },
    { $lookup: { from: "books", localField: "book", foreignField: "_id", as: "book", pipeline: [{ $project: { title: 1 } }] } },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "users", localField: "member", foreignField: "_id", as: "member", pipeline: [{ $project: { name: 1, membershipId: 1 } }] } },
    { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        daysOverdue: {
          $dateDiff: {
            startDate: { $dateTrunc: { date: "$dueDate", unit: "day" } },
            endDate: { $dateTrunc: { date: startOfDay(now), unit: "day" } },
            unit: "day",
          },
        },
      },
    },
    { $sort: { daysOverdue: -1, dueDate: 1 } },
  ]);

  const rows: ReportRow[] = raw.map((loan) => {
    const days = loan.daysOverdue ?? 0;
    const potential = cap > 0 ? Math.min(days * ratePerDay, cap) : days * ratePerDay;
    return {
      id: String(loan._id),
      book: loan.book?.title ?? "Unknown title",
      member: loan.member?.name ?? "Unknown member",
      membershipId: loan.member?.membershipId ?? "—",
      due: format(loan.dueDate, "d MMM yyyy"),
      daysOverdue: days,
      potentialValue: Number(potential.toFixed(2)),
      potential: formatCurrency(potential),
    };
  });

  const total = rows.reduce((sum, row) => sum + (row.potentialValue as number), 0);
  const worst = rows.reduce((peak, row) => Math.max(peak, row.daysOverdue as number), 0);
  const members = new Set(rows.map((row) => row.member)).size;

  return {
    summary: [
      { label: "Overdue loans", value: rows.length.toLocaleString("en-US"), tone: rows.length > 0 ? ("danger" as const) : ("success" as const) },
      { label: "Members affected", value: members.toLocaleString("en-US") },
      { label: "Longest", value: worst > 0 ? `${worst} ${worst === 1 ? "day" : "days"}` : "—" },
      { label: "Potential fines", value: formatCurrency(total) },
    ],
    columns: [
      { key: "book", label: "Book", emphasis: true },
      { key: "member", label: "Member" },
      { key: "membershipId", label: "Membership ID" },
      { key: "due", label: "Was due" },
      { key: "daysOverdue", label: "Days late", align: "right" },
      { key: "potential", label: `Potential fine (${formatCurrency(ratePerDay)}/day)`, align: "right" },
    ] satisfies ReportColumn[],
    allRows: rows,
  };
}

/* -------------------------------------------------------------------------- */
/* 3. Popular books                                                            */
/* -------------------------------------------------------------------------- */

async function popularReport(ctx: ReportContext) {
  const { from, to, bookIds } = ctx;

  const raw = await Loan.aggregate<{
      _id: Types.ObjectId;
      /** `$unwind` puts the looked-up document back under `book`; it does not flatten it. */
      book: {
        title: string;
        slug: string;
        borrowCount: number;
        ratingAvg: number;
        ratingCount: number;
        totalCopies: number;
        availableCopies: number;
      } | null;
      /** Likewise `category`, from the second `$lookup`. */
      category: { name: string } | null;
      loans: number;
    }>([
    { $match: dateWindow(from, to) },
    { $group: { _id: "$book", loans: { $sum: 1 } } },
    { $sort: { loans: -1, _id: 1 } },
    { $lookup: { from: "books", localField: "_id", foreignField: "_id", as: "book", pipeline: [{ $project: { title: 1, slug: 1, borrowCount: 1, ratingAvg: 1, ratingCount: 1, totalCopies: 1, availableCopies: 1, category: 1, status: 1 } }] } },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
    { $match: { "book.status": "active", ...(bookIds ? { "_id": { $in: bookIds } } : {}) } },
    { $lookup: { from: "categories", localField: "book.category", foreignField: "_id", as: "category", pipeline: [{ $project: { name: 1 } }] } },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
  ]);

  /*
   * **Read from `row.book.*`, not `row.title`.** A `$unwind` on a non-array document replaces
   * that *field* with the object — it does not spread the object onto the parent. Reading
   * `row.title` therefore yields `undefined` for every row, and because `JSON.stringify` drops
   * undefined values, the client receives a row with no `title` key at all and the table renders
   * an em dash. The first version of this report showed "Unknown title" for all 51 books and
   * "0 of 0" for every availability, and every status check passed — the keys were present, only
   * the values were wrong.
   */
  const rows: ReportRow[] = raw.map((row) => ({
    id: String(row._id),
    title: row.book?.title ?? "Unknown title",
    category: row.category?.name ?? "—",
    loans: row.loans,
    loansAllTime: row.book?.borrowCount ?? 0,
    rating:
      (row.book?.ratingAvg ?? 0) > 0
        ? `${(row.book?.ratingAvg ?? 0).toFixed(1)} (${row.book?.ratingCount ?? 0})`
        : "—",
    available: `${row.book?.availableCopies ?? 0} of ${row.book?.totalCopies ?? 0}`,
  }));

  const totalLoans = rows.reduce((sum, row) => sum + (row.loans as number), 0);

  return {
    summary: [
      { label: "Titles borrowed", value: rows.length.toLocaleString("en-US") },
      { label: "Loans in period", value: totalLoans.toLocaleString("en-US") },
      { label: "Busiest", value: rows[0] ? String(rows[0].title) : "—" },
      {
        label: "Never lent",
        value: (await countUnlent()).toLocaleString("en-US"),
      },
    ],
    columns: [
      { key: "title", label: "Title", emphasis: true },
      { key: "category", label: "Category" },
      { key: "loans", label: "Loans in period", align: "right" },
      { key: "loansAllTime", label: "All-time loans", align: "right" },
      { key: "rating", label: "Rating" },
      { key: "available", label: "On shelf", align: "right" },
    ] satisfies ReportColumn[],
    allRows: rows,
  };
}

/** How many active titles have never been lent at all — the complement to a "popular" list. */
async function countUnlent(): Promise<number> {
  return Book.countDocuments({ status: "active", borrowCount: 0 });
}

/* -------------------------------------------------------------------------- */
/* 4. Member activity                                                          */
/* -------------------------------------------------------------------------- */

async function membersReport(ctx: ReportContext) {
  const { from, to, bookIds } = ctx;

  const raw = await Loan.aggregate<{
      _id: Types.ObjectId;
      /** `$unwind` keeps the member under `member`; it does not flatten it onto the parent. */
      member: { name: string; membershipId: string | null; role: string; status: string };
      loans: number;
      /** `$lookup` always returns an **array**, even for a `$group`-ed single result. */
      current: Array<{ active: number; overdue: number }>;
    }>([
    { $match: dateWindow(from, to) },
    { $group: { _id: "$member", loans: { $sum: 1 } } },
    { $sort: { loans: -1, _id: 1 } },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "member", pipeline: [{ $project: { name: 1, membershipId: 1, role: 1, status: 1 } }] } },
    { $unwind: { path: "$member" } },
    { $match: { "member.role": "member", ...(bookIds ? { "_id": { $in: bookIds } } : {}) } },
    // Active and overdue counts come from a second lookup over the member's *current* loans, so
    // "borrowed in the period" and "still out now" stay two different questions.
    {
      $lookup: {
        from: "loans",
        let: { memberId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$member", "$$memberId"] } } },
          {
            $group: {
              _id: null,
              active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
              overdue: {
                $sum: {
                  $cond: [
                    { $and: [{ $eq: ["$status", "active"] }, { $lt: ["$dueDate", startOfDay(ctx.now)] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        as: "current",
      },
    },
  ]);

  const memberIds = raw.map((row) => row._id);
  const unpaid = await Fine.aggregate<{ _id: Types.ObjectId; total: number; count: number }>([
    { $match: { status: "unpaid", member: { $in: memberIds } } },
    { $group: { _id: "$member", total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  const unpaidBy = new Map(unpaid.map((row) => [String(row._id), row]));

  const rows: ReportRow[] = raw.map((row) => {
    const due = unpaidBy.get(String(row._id));
    // **The `$lookup` for current loans returns an array**, so the group result is `current[0]`.
    // Reading `row.activeLoans` found nothing and every member read as "0 still out, 0 overdue".
    const current = row.current?.[0];

    return {
      id: String(row._id),
      name: row.member?.name ?? "Unknown member",
      membershipId: row.member?.membershipId ?? "—",
      account: row.member?.status === "active" ? "Active" : "Suspended",
      loans: row.loans,
      activeLoans: current?.active ?? 0,
      overdueLoans: current?.overdue ?? 0,
      unpaidValue: Number((due?.total ?? 0).toFixed(2)),
      unpaid: due?.count ? `${formatCurrency(due.total)} (${due.count})` : "—",
    };
  });

  const totalLoans = rows.reduce((sum, row) => sum + (row.loans as number), 0);
  const totalUnpaid = rows.reduce((sum, row) => sum + (row.unpaidValue as number), 0);

  return {
    summary: [
      { label: "Members borrowing", value: rows.length.toLocaleString("en-US") },
      { label: "Loans in period", value: totalLoans.toLocaleString("en-US") },
      {
        label: "Overdue loans",
        value: rows.reduce((sum, row) => sum + (row.overdueLoans as number), 0).toLocaleString("en-US"),
      },
      { label: "Unpaid fines", value: formatCurrency(totalUnpaid), tone: totalUnpaid > 0 ? ("warning" as const) : ("success" as const) },
    ],
    columns: [
      { key: "name", label: "Member", emphasis: true },
      { key: "membershipId", label: "Membership ID" },
      { key: "account", label: "Account" },
      { key: "loans", label: "Loans in period", align: "right" },
      { key: "activeLoans", label: "Still out", align: "right" },
      { key: "overdueLoans", label: "Overdue", align: "right" },
      { key: "unpaid", label: "Unpaid fines", align: "right" },
    ] satisfies ReportColumn[],
    allRows: rows,
  };
}

/* -------------------------------------------------------------------------- */
/* 5. Fines                                                                    */
/* -------------------------------------------------------------------------- */

async function finesReport(ctx: ReportContext) {
  const { from, to, bookIds } = ctx;

  const bookFilter = bookIds ? { book: { $in: bookIds } } : {};
  const raw = await Fine.aggregate<{
      _id: Types.ObjectId;
      amount: number;
      daysOverdue: number;
      ratePerDay: number;
      status: string;
      createdAt: Date;
      paidAt: Date | null;
      book: { title: string } | null;
      member: { name: string; membershipId: string | null } | null;
    }>([
    { $match: { ...dateWindow(from, to, "createdAt"), ...bookFilter } },
    { $lookup: { from: "books", localField: "book", foreignField: "_id", as: "book", pipeline: [{ $project: { title: 1 } }] } },
    { $unwind: { path: "$book", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "users", localField: "member", foreignField: "_id", as: "member", pipeline: [{ $project: { name: 1, membershipId: 1 } }] } },
    { $unwind: { path: "$member", preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1, _id: 1 } },
  ]);

  const rows: ReportRow[] = raw.map((fine) => ({
    id: String(fine._id),
    book: fine.book?.title ?? "Unknown title",
    member: fine.member?.name ?? "Unknown member",
    membershipId: fine.member?.membershipId ?? "—",
    raised: format(fine.createdAt, "d MMM yyyy"),
    daysOverdue: fine.daysOverdue,
    rate: `${formatCurrency(fine.ratePerDay)}/day`,
    amountValue: Number((fine.amount ?? 0).toFixed(2)),
    amount: formatCurrency(fine.amount ?? 0),
    status: fine.status === "unpaid" ? "Unpaid" : fine.status === "paid" ? "Collected" : "Waived",
  }));

  const total = (status: string) => rows.filter((row) => row.status === status);
  const sum = (list: ReportRow[]) => list.reduce((acc, row) => acc + (row.amountValue as number), 0);

  const paid = total("Collected");
  const waived = total("Waived");
  const unpaid = total("Unpaid");

  return {
    summary: [
      { label: "Fines raised", value: rows.length.toLocaleString("en-US") },
      { label: "Collected", value: formatCurrency(sum(paid)), tone: "success" as const },
      { label: "Waived", value: formatCurrency(sum(waived)) },
      {
        label: "Still unpaid",
        value: formatCurrency(sum(unpaid)),
        tone: unpaid.length > 0 ? ("warning" as const) : ("success" as const),
      },
    ],
    columns: [
      { key: "book", label: "Book", emphasis: true },
      { key: "member", label: "Member" },
      { key: "membershipId", label: "Membership ID" },
      { key: "raised", label: "Raised" },
      { key: "daysOverdue", label: "Days late", align: "right" },
      { key: "rate", label: "Rate", align: "right" },
      { key: "amount", label: "Amount", align: "right" },
      { key: "status", label: "Status" },
    ] satisfies ReportColumn[],
    allRows: rows,
  };
}

/* -------------------------------------------------------------------------- */
/* 6. Inventory                                                                */
/* -------------------------------------------------------------------------- */

async function inventoryReport(ctx: ReportContext) {
  const { bookIds } = ctx;

  const rows_raw = await Book.aggregate<{ _id: Types.ObjectId; title: string; slug: string; totalCopies: number; availableCopies: number; borrowCount: number; categoryName: string | null; shelfLocation: string | null }>([
    { $match: { status: "active", ...(bookIds ? { _id: { $in: bookIds } } : {}) } },
    { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "category", pipeline: [{ $project: { name: 1 } }] } },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    { $sort: { title: 1, _id: 1 } },
  ]);

  // Held counts come from the queue layer rather than a second aggregation, so "held" here means
  // exactly what it means on the reservations register (Unit 14's single definition).
  const holdCounts = await heldCounts();

  const rows: ReportRow[] = rows_raw.map((book) => {
    // Invariant 6: `availableCopies` is only ever changed by circulation, so on-loan is derived
    // rather than stored — and a held copy is included, because it is not on the shelf.
    const onLoan = Math.max(0, book.totalCopies - book.availableCopies);
    const held = holdCounts.get(String(book._id)) ?? 0;
    const free = Math.max(0, book.availableCopies - held);

    return {
      id: String(book._id),
      title: book.title,
      category: book.categoryName ?? "—",
      shelfLocation: book.shelfLocation ?? "—",
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      freeValue: free,
      free,
      onLoanValue: onLoan,
      onLoan,
      heldValue: held,
      held,
      borrowCount: book.borrowCount,
      status: free === 0 ? "Out" : free === 1 ? "1 left" : "Available",
    };
  });

  const sum = (key: string) => rows.reduce((acc, row) => acc + (row[key] as number), 0);
  const lowStock = rows.filter((row) => (row.freeValue as number) <= 1).length;

  return {
    summary: [
      { label: "Active titles", value: rows.length.toLocaleString("en-US") },
      { label: "Total copies", value: sum("totalCopies").toLocaleString("en-US") },
      { label: "On loan", value: sum("onLoanValue").toLocaleString("en-US") },
      { label: "Held", value: sum("heldValue").toLocaleString("en-US") },
      {
        label: "Low stock",
        value: lowStock.toLocaleString("en-US"),
        tone: lowStock > 0 ? ("warning" as const) : ("success" as const),
      },
    ],
    columns: [
      { key: "title", label: "Title", emphasis: true },
      { key: "category", label: "Category" },
      { key: "shelfLocation", label: "Shelf" },
      { key: "totalCopies", label: "Copies", align: "right" },
      { key: "free", label: "On shelf", align: "right" },
      { key: "onLoan", label: "On loan", align: "right" },
      { key: "held", label: "Held", align: "right" },
      { key: "status", label: "Status" },
    ] satisfies ReportColumn[],
    allRows: rows,
  };
}

/**
 * How many copies of each book are promised to somebody — `waiting` plus `ready`.
 *
 * **This is deliberately a local aggregation, not a call into `hooks.ts`.** The queue layer's
 * `getReadyHoldCounts` answers "how many are *ready*, i.e. consuming a copy right now"; this
 * column is a different number — "how many promises exist against this title, ready or not" —
 * which is what a stock-take needs. Reaching for the ready-only helper would answer a question
 * nobody asked and quietly under-report every queued title.
 */
async function heldCounts(): Promise<Map<string, number>> {
  const raw = await Reservation.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { status: { $in: ["waiting", "ready"] } } },
    { $group: { _id: "$book", count: { $sum: 1 } } },
  ]);
  return new Map(raw.map((row) => [String(row._id), row.count]));
}

/* -------------------------------------------------------------------------- */
/* Categories for the filter                                                   */
/* -------------------------------------------------------------------------- */

/** The category options for the filter, resolved once per request. */
export async function listReportCategories(): Promise<Array<{ id: string; name: string }>> {
  const rows = await Category.find({}).select("name").sort({ name: 1 }).lean<Array<{ _id: Types.ObjectId; name: string }>>();
  return rows.map((row) => ({ id: String(row._id), name: row.name }));
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Escape one CSV field.
 *
 * **RFC 4180: a field containing a comma, a quote, a newline or a tab must be quoted, and an
 * embedded quote must be doubled.** Skipping the doubling is the bug that turns a member named
 * `O"Brien, Ann` into a row Excel reads as three columns, silently, with no error anywhere.
 *
 * A leading `=`, `+`, `-` or `@` is prefixed with an apostrophe — **CSV injection**. A cell
 * beginning `=HYPERLINK(...)` executes when the file is opened in Excel; a report is full of
 * user-controlled text (book titles, member names) and an export nobody inspects is an export
 * anybody can send.
 */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r\t]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Render a report as RFC 4180 CSV.
 *
 * **The BOM is not optional.** Without a UTF-8 byte-order mark, Excel on Windows reads the file
 * as the local codepage, and `Ursula K. Le Guin` becomes `Ursula K. Le Guin?` — every non-ASCII
 * character in the report silently mangled. The spec asks for it and it is the single most common
 * reason a "correct" CSV export looks wrong.
 *
 * **Written as the escape `\uFEFF` rather than a literal invisible character.** The literal form
 * was in the source first, and an editor or an encoding round-trip turned it into a `?` with no
 * error anywhere — the export still 200'd, still had the right headers, and quietly lost the BOM.
 * An escape cannot be corrupted by anything that does not understand it, and it can be *seen* in
 * a diff, which an invisible character cannot.
 *
 * **CRLF line endings**, which is what RFC 4180 specifies and what Excel expects; a `\n`-joined
 * file opens with the last row glued to the header on some platforms.
 */
export function toCsv(columns: ReportColumn[], rows: ReportRow[]): string {
  const header = columns.map((column) => csvField(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => csvField(row[column.key])).join(","));
  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}

/** `athenaeum-<type>-<date>.csv`, e.g. `athenaeum-fines-2026-10-10.csv`. */
export function csvFilename(reportType: string, now = new Date()): string {
  return `athenaeum-${reportType}-${format(now, "yyyy-MM-dd")}.csv`;
}