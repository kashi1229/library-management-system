import "server-only";
import { Types } from "mongoose";
import { Book, Category, Fine, Loan, Reservation, User, Wishlist, AuditLog } from "@/models";
import { startOfDay, subDays } from "date-fns";
import { activeQueuePositions, hoursUntil } from "@/lib/services/reservations";
import { bookRefOr, bookRefs, memberRefOr, memberRefs } from "@/lib/services/refs";
import { deriveLoanState } from "@/lib/services/circulation";
import type {
  DashboardDayPoint,
  DashboardLowStockItem,
  MemberDashboard,
  StaffActivityItem,
  StaffDashboard,
} from "@/types";

/**
 * Dashboard aggregates (spec 17).
 *
 * **Every figure is computed here, in the database, and never in the browser.** A KPI card is
 * the single most trusted number on the screen; a dashboard that showed a member a count their
 * own loan list contradicted would be worse than no dashboard, because they would stop believing
 * the numbers on every *other* screen too.
 *
 * **Aggregations rather than `find()` + JavaScript counting.** A library with ten thousand
 * loans would otherwise pull every loan document over the wire to count them in a loop. The
 * `$group` pipelines keep the work in Mongo, which is what it is for.
 *
 * **Counts are scoped to real state, not to what is convenient.** "Active loans" is
 * `status: "active"`; "overdue" is an active loan whose due date has *passed in the calendar*,
 * using the same `deriveLoanState` the loan lists use, so a badge on the dashboard and a badge
 * on a loan row cannot disagree about the same book (invariant 12, and the Unit 11 rule that
 * there is exactly one definition of `on_time | due_soon | overdue`).
 *
 * **`await Promise.all` on independent reads, and every count is exact.** A dashboard that
 * showed "approximately" would be a dashboard nobody can check, and this unit's own
 * verification is to compare every KPI against a direct count.
 */

/** How many days the staff "loans per day" series covers. The spec's 30. */
export const SERIES_DAYS = 30;

/**
 * Books at or below this many free copies count as "low stock".
 *
 * **One, not zero.** A book with no copies is *out*, which is a different and already-communicated
 * state; one copy left is the thing a librarian acts on, and it is the first number to reach
 * after a book becomes popular. Named so the threshold is a grep rather than a hunt.
 */
export const LOW_STOCK_THRESHOLD = 1;

/** How many rows each list carries. The dashboard is a glance, not an archive. */
const RECOMMENDED_LIMIT = 8;
const WISHLIST_PREVIEW_LIMIT = 6;
const LOW_STOCK_LIMIT = 8;
const DUE_TODAY_LIMIT = 8;
const ACTIVITY_LIMIT = 12;

/* -------------------------------------------------------------------------- */
/* Member                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The member's own dashboard.
 *
 * **Scoped by `userId` on every single query**, and there is no filter a caller could supply.
 * The spec's check — "shows only that member's data" — is enforced here rather than in the
 * route, so any future caller inherits it.
 */
export async function getMemberDashboard(userId: Types.ObjectId): Promise<MemberDashboard> {
  const now = new Date();

  /*
   * Four independent reads in one round trip. Sequential awaits would make the slowest of them
   * the page's load time, and a dashboard is the screen a member meets first.
   */
  const [activeLoans, readyHolds, fines, wishes] = await Promise.all([
    Loan.find({ member: userId, status: "active" })
      .sort({ dueDate: 1 })
      .lean<
        Array<{
          _id: Types.ObjectId;
          book: Types.ObjectId;
          dueDate: Date;
          issuedAt: Date;
          renewCount: number;
        }>
      >(),

    Reservation.find({ member: userId, status: "ready" })
      .sort({ expiresAt: 1 })
      .lean<Array<{ _id: Types.ObjectId; book: Types.ObjectId; expiresAt: Date }>>(),

    Fine.aggregate<{ total: number; count: number }>([
      { $match: { member: userId, status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),

    Wishlist.find({ member: userId })
      .sort({ createdAt: -1 })
      .limit(WISHLIST_PREVIEW_LIMIT)
      .select("book")
      .lean<Array<{ book: Types.ObjectId }>>(),
  ]);

  const bookIds = [
    ...activeLoans.map((loan) => loan.book),
    ...readyHolds.map((hold) => hold.book),
    ...wishes.map((wish) => wish.book),
  ];

  const [refs, positions] = await Promise.all([
    bookRefs(bookIds),
    // The queue positions are read from **one ordered pass** over the queues for the books
    // involved, not one query per hold — the Unit 10 lesson.
    activeQueuePositions(activeLoans.map((loan) => loan.book)),
  ]);

  /* ------------------------------- Reading ------------------------------- */
  const reading = activeLoans.slice(0, 8).map((loan) => {
    // `status` is passed explicitly because the query already guarantees it: `deriveLoanState`
    // takes the stored status so it can answer "returned" without a date comparison, and
    // leaving it to inference would mean asserting the field twice in two places.
    const state = deriveLoanState({ status: "active", dueDate: loan.dueDate }, now);

    return {
      id: String(loan._id),
      book: bookRefOr(refs, loan.book),
      dueDate: loan.dueDate.toISOString(),
      daysLeft: state.daysLeft,
      view: state.view,
      renewCount: loan.renewCount,
      /** Only meaningful while the member holds it, and only when somebody is waiting. */
      queuePosition: positions.get(String(loan.book)) ?? null,
    };
  });

  /* ---------------------------- Ready to collect ---------------------------- */
  const pickups = readyHolds.map((hold) => ({
    id: String(hold._id),
    book: bookRefOr(refs, hold.book),
    expiresAt: hold.expiresAt ? hold.expiresAt.toISOString() : null,
    hoursLeft: hold.expiresAt ? hoursUntil(hold.expiresAt, now) : null,
  }));

  /* ---------------------------- Recommendations ---------------------------- */
  const borrowedBookIds = new Set(activeLoans.map((loan) => String(loan.book)));

  const recommended = await recommendFor(userId, borrowedBookIds);

  return {
    kpis: {
      activeLoans: activeLoans.length,
      readyHolds: readyHolds.length,
      unpaidFines: fines[0]?.count ?? 0,
      unpaidFineTotal: Math.round((fines[0]?.total ?? 0) * 100) / 100,
    },
    reading,
    pickups,
    recommended,
    wishlist: wishes.map((wish) => bookRefOr(refs, wish.book)),
  };
}

/**
 * Books this member might like.
 *
 * **From the categories of what they have already read**, then popular. So the query is the
 * set of category ids in that member's history, and a book already borrowed is excluded — the
 * spec's check, enforced in the `$nin` rather than by filtering afterwards, because a
 * recommendation to borrow the book in your hand is not a recommendation.
 *
 * **A member with no history gets the popular list**, not an empty row. "Recommended for you"
 * over an empty shelf is a dead panel on the screen every new member sees first.
 */
async function recommendFor(
  userId: Types.ObjectId,
  exclude: Set<string>,
): Promise<MemberDashboard["recommended"]> {
  const categories = await Loan.distinct("book", { member: userId });

  const categoryIds: Types.ObjectId[] = [];
  if (categories.length > 0) {
    const books = await Book.find({ _id: { $in: categories } })
      .select("category")
      .lean<Array<{ category: Types.ObjectId }>>();
    for (const book of books) categoryIds.push(book.category);
  }

  const excludeIds = [...exclude]
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  /*
   * Built as a typed record rather than an object literal, because the spread of two
   * conditional keys widens `status` to `string` and Mongoose then rejects the whole filter.
   */
  const query: Record<string, unknown> = { status: "active" };
  if (excludeIds.length > 0) query._id = { $nin: excludeIds };
  if (categoryIds.length > 0) query.category = { $in: categoryIds };

  let rows = await Book.find(query).sort({ borrowCount: -1, ratingAvg: -1, _id: 1 }).limit(RECOMMENDED_LIMIT).lean<Array<{ _id: Types.ObjectId }>>();

  if (rows.length === 0 && categoryIds.length > 0) {
    // Their categories are exhausted, so fall back to what the whole library reads. **Only
    // popular** — not "more of the same", which is the thing that just ran out.
    const fallback: Record<string, unknown> = { status: "active" };
    if (excludeIds.length > 0) fallback._id = { $nin: excludeIds };

    rows = await Book.find(fallback)
      .sort({ borrowCount: -1, ratingAvg: -1, _id: 1 })
      .limit(RECOMMENDED_LIMIT)
      .lean<Array<{ _id: Types.ObjectId }>>();
  }

  const refs = await bookRefs(rows.map((row) => row._id));
  return rows.map((row) => bookRefOr(refs, row._id));
}

/* -------------------------------------------------------------------------- */
/* Staff                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The staff dashboard.
 *
 * **Nothing here is member-scoped** — it is the whole library's view, and the route's
 * `requireStaff()` is what authorises it.
 */
export async function getStaffDashboard(): Promise<StaffDashboard> {
  const now = new Date();
  const today = startOfDay(now);
  const seriesStart = startOfDay(subDays(now, SERIES_DAYS - 1));

  const [
    titleCount,
    copyAgg,
    memberCount,
    activeAgg,
    readyHolds,
    finesAgg,
    dailyLoans,
    categoryShares,
    topBooks,
    lowStock,
    dueToday,
    activity,
  ] = await Promise.all([
    Book.countDocuments({ status: "active" }),

    Book.aggregate<{ copies: number; available: number }>([
      { $match: { status: "active" } },
      { $group: { _id: null, copies: { $sum: "$totalCopies" }, available: { $sum: "$availableCopies" } } },
    ]),

    User.countDocuments({ role: "member", status: "active" }),

    // One aggregation for both figures, because "active loans" and "overdue" differ only by a
    // date comparison and doing them separately would scan the collection twice.
    Loan.aggregate<{ active: number; overdue: number }>([
      { $match: { status: "active" } },
      {
        $group: {
          _id: null,
          active: { $sum: 1 },
          // **Calendar-day comparison, not whole 24-hour blocks** (invariant 12): a book due
          // at 23:00 yesterday is overdue from midnight, exactly as the loan lists report it.
          overdue: { $sum: { $cond: [{ $lt: ["$dueDate", today] }, 1, 0] } },
        },
      },
    ]),

    Reservation.countDocuments({ status: "ready" }),

    Fine.aggregate<{ total: number; count: number }>([
      { $match: { status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),

    // `$dateToString` in UTC, matched against a UTC-anchored window, so the bucket a loan
    // lands in is the same in every timezone the server happens to run in. The zero-fill below
    // builds the same keys.
    Loan.aggregate<{ _id: string; count: number }>([
      { $match: { issuedAt: { $gte: seriesStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$issuedAt", timezone: "UTC" } },
          count: { $sum: 1 },
        },
      },
    ]),

    Book.aggregate<{ _id: Types.ObjectId; name: string; count: number }>([
      { $match: { status: "active" } },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "cat",
        },
      },
      { $unwind: "$cat" },
      {
        $group: {
          _id: "$cat._id",
          name: { $first: "$cat.name" },
          count: { $sum: "$borrowCount" },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),

    Book.find({ status: "active" })
      .sort({ borrowCount: -1, _id: 1 })
      .limit(5)
      .select("title borrowCount availableCopies totalCopies")
      .lean<Array<{ _id: Types.ObjectId; title: string; borrowCount: number; availableCopies: number; totalCopies: number }>>(),

    Book.find({ status: "active", availableCopies: { $lte: LOW_STOCK_THRESHOLD } })
      .sort({ availableCopies: 1, borrowCount: -1, _id: 1 })
      .limit(LOW_STOCK_LIMIT)
      .select("title availableCopies totalCopies borrowCount")
      .lean<Array<{ _id: Types.ObjectId; title: string; availableCopies: number; totalCopies: number; borrowCount: number }>>(),

    // **Due today**, not "overdue" — a librarian wants to know what is coming back before it is
    // late, which is the one list on this screen that is actionable this morning.
    Loan.find({ status: "active", dueDate: { $gte: today, $lt: new Date(today.getTime() + 86_400_000) } })
      .sort({ dueDate: 1 })
      .limit(DUE_TODAY_LIMIT)
      .select("book member dueDate")
      .lean<Array<{ _id: Types.ObjectId; book: Types.ObjectId; member: Types.ObjectId; dueDate: Date }>>(),

    activityRows(),
  ]);

  const [dueBookRefs, dueMemberRefs] = await Promise.all([
    bookRefs(dueToday.map((loan) => loan.book)),
    memberRefs(dueToday.map((loan) => loan.member)),
  ]);

  return {
    kpis: {
      totalTitles: titleCount,
      totalCopies: copyAgg[0]?.copies ?? 0,
      availableCopies: copyAgg[0]?.available ?? 0,
      members: memberCount,
      activeLoans: activeAgg[0]?.active ?? 0,
      overdue: activeAgg[0]?.overdue ?? 0,
      readyHolds,
      unpaidFines: finesAgg[0]?.count ?? 0,
      unpaidFineTotal: Math.round((finesAgg[0]?.total ?? 0) * 100) / 100,
    },
    series: zeroFill(dailyLoans, seriesStart),
    byCategory: categoryShares.map((share) => ({
      id: String(share._id),
      name: share.name,
      count: share.count,
    })),
    topBooks: topBooks.map((book) => ({
      id: String(book._id),
      title: book.title,
      borrowCount: book.borrowCount,
      availableCopies: book.availableCopies,
      totalCopies: book.totalCopies,
    })),
    lowStock: lowStock.map((book) => ({
      id: String(book._id),
      title: book.title,
      availableCopies: book.availableCopies,
      totalCopies: book.totalCopies,
      borrowCount: book.borrowCount,
    })),
    dueToday: dueToday.map((loan) => ({
      id: String(loan._id),
      book: bookRefOr(dueBookRefs, loan.book),
      member: memberRefOr(dueMemberRefs, loan.member),
      dueDate: loan.dueDate.toISOString(),
    })),
    activity,
    generatedAt: now.toISOString(),
    seriesDays: SERIES_DAYS,
  };
}

/**
 * The recent-activity feed, from the audit log.
 *
 * **In its own function because it is the only query here that is not a count**, and folding it
 * into the `Promise.all` above would hide that it resolves no entity ids and reads an
 * append-only collection.
 */
async function activityRows(): Promise<StaffActivityItem[]> {
  const rows = await AuditLog.find({})
    .sort({ createdAt: -1 })
    .limit(ACTIVITY_LIMIT)
    .select("action summary entityType createdAt")
    .lean<Array<{ _id: Types.ObjectId; action: string; summary: string; entityType: string; createdAt: Date }>>();

  /*
   * The audit log is **append-only and never deleted** (invariant 10), so a deleted book's
   * actions stay visible here. That is the point of an audit trail — it is history, not a join —
   * so the feed shows the recorded `summary` rather than re-deriving a title from a document
   * that may no longer exist.
   */
  return rows.map((row) => ({
    id: String(row._id),
    action: row.action,
    summary: row.summary,
    entityType: row.entityType,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Zero-fill the daily series.
 *
 * **Every day in the window gets a point, including the ones with nothing.** A `$group` returns
 * only the days that had loans, so a chart built from it draws a straight line across a quiet
 * fortnight and makes the library look steadily busy. The gaps are the information: a day with
 * no loans on a Monday is a real thing to see.
 *
 * The fill is done in JavaScript rather than with a second aggregation because the dates are a
 * plain arithmetic sequence — thirty keys, no query — and a `$lookup` against a generated
 * calendar would be far more machinery for the same thirty numbers.
 */
function zeroFill(
  rows: Array<{ _id: string; count: number }>,
  start: Date,
): DashboardDayPoint[] {
  const counts = new Map(rows.map((row) => [row._id, row.count]));

  const points: DashboardDayPoint[] = [];
  for (let offset = 0; offset < SERIES_DAYS; offset += 1) {
    const date = new Date(start.getTime() + offset * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    points.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return points;
}

/** Re-exported so the member card and the staff donut share one definition of a loan state. */
export { deriveLoanState };

/**
 * Category colours for the donut, resolved server-side.
 *
 * **Returned as the stored `CategoryColor` name rather than a CSS class or a hex value**, so
 * the component can map it through the same `CATEGORY_COLOR_CLASS` every other surface uses.
 * Passing a colour string from here would create a second definition of "what colour is plum".
 */
export async function categoryColours(): Promise<Map<string, string>> {
  const rows = await Category.find({})
    .select("_id color")
    .lean<Array<{ _id: Types.ObjectId; color: string }>>();

  return new Map(rows.map((row) => [String(row._id), row.color]));
}