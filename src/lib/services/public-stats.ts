import "server-only";
import { Book, Loan, User } from "@/models";
import { listCategories, toCategorySummary } from "@/lib/services/categories";
import { listBooks } from "@/lib/services/books";
import type { CategorySummary, PublicStats } from "@/types";

/**
 * The one read behind the landing page's live figures (F17).
 *
 * **Every number is counted in Mongo, not in JavaScript.** Pulling the catalog over the wire to
 * add it up in a loop is the mistake the Unit 17 dashboard avoided, and a landing page that every
 * anonymous visitor loads is the most likely place in the app to repeat it.
 *
 * **`loansThisMonth` is a thirty-day window, not a lifetime total.** A lifetime figure only ever
 * increases, so on a library that has run for years it says nothing about whether the place is
 * alive; the band labels the figure "this month" so the window is never a surprise.
 */

/** How many covers the hero cluster and the carousel hold without becoming a wall. */
const NEW_ARRIVALS_LIMIT = 8;

export const LOAN_STATS_WINDOW_DAYS = 30;

/** Categories shown before the showcase starts hiding shelves. */
const SHOWCASE_CATEGORY_LIMIT = 8;

export async function getPublicStats(): Promise<PublicStats> {
  const since = new Date();
  since.setDate(since.getDate() - LOAN_STATS_WINDOW_DAYS);

  const [bookAgg, members, loansThisMonth, arrivals, categories] = await Promise.all([
    // `$group` rather than two `countDocuments`, because "titles" and "copies" are two sums
    // over one scan.
    Book.aggregate<{ books: number; copies: number }>([
      { $match: { status: "active" } },
      { $group: { _id: null, books: { $sum: 1 }, copies: { $sum: "$totalCopies" } } },
    ]),
    User.countDocuments({ role: "member", status: "active" }),
    Loan.countDocuments({ issuedAt: { $gte: since } }),
    // `userId` is deliberately omitted. This list is rendered for signed-out visitors on the
    // landing page, so every heart would be unsaved (invariant 3: no member id, ever, from a
    // public read).
    listBooks({ page: 1, limit: NEW_ARRIVALS_LIMIT, sort: "newest", status: "active" }),
    listCategories(),
  ]);

  return {
    books: bookAgg[0]?.books ?? 0,
    copies: bookAgg[0]?.copies ?? 0,
    members,
    loansThisMonth,
    newArrivals: arrivals.items,
    categories: categories.map(toCategorySummary),
  };
}

/**
 * The categories worth linking a visitor to, with the shelves that are left out.
 *
 * **A category tile that opens an empty filtered catalog is a dead end**, and a showcase of
 * fifteen tiles where seven are empty is worse than eight that work — so only categories holding
 * at least one active book are offered.
 *
 * **The caller is told how many were dropped.** The "a capped list must say it is capped" rule
 * from the Unit 10 member record: eight of eleven with no note reads as "this is everything".
 *
 * The counts come from `listCategories()`, which already resolves them in a single `$lookup`, so
 * this adds no round trip over what the stats read has already paid for.
 */
export function pickShowcaseCategories(
  categories: CategorySummary[],
  limit = SHOWCASE_CATEGORY_LIMIT,
): { categories: CategorySummary[]; hidden: number } {
  const populated = categories.filter((category) => category.bookCount > 0);
  return {
    categories: populated.slice(0, limit),
    hidden: Math.max(0, populated.length - limit),
  };
}