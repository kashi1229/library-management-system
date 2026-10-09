import "server-only";
import { Types, type ClientSession } from "mongoose";
import { AppError } from "@/lib/api";
import { withTransaction } from "@/lib/db";
import { Book, Loan, Review, User } from "@/models";
import { logAudit } from "@/lib/services/audit";
import type { ListReviewsQuery, UpsertReviewInput } from "@/lib/validators/review";
import type {
  Actor,
  CloudinaryImage,
  PageMeta,
  RatingSummary,
  ReviewListResult,
  ReviewSummary,
} from "@/types";

/**
 * Review service (F10, spec 15).
 *
 * ## Business rule 9
 *
 * A member may review a book **only if they have borrowed it at least once, in any
 * state** — returned or still out. That is the whole rule, and it is checked against the
 * `Loan` collection rather than inferred from anything else, because "has this member read
 * this book" has exactly one source of truth and inventing a second is how a review system
 * ends up rating books nobody opened.
 *
 * ## The aggregate lives on the book
 *
 * `ratingAvg` / `ratingCount` are **denormalised** onto the Book document so the catalog
 * never has to aggregate reviews to render a card — there are 32 books in the grid and a
 * `$group` per card would be a hundred round trips on one page.
 *
 * That makes the recompute a genuine multi-document write, so it runs in a transaction with
 * the review itself (invariant 5). **A review written without its aggregate landing is worse
 * than no review**: the catalog would show a stale average for ever, with nothing to tell a
 * librarian which review caused it. One transaction means the row and the number it
 * contributed to either both land or neither does.
 */

/** Staff may moderate anyone's review; a member only their own. */
function isStaff(role: Actor["role"]): boolean {
  return role === "admin" || role === "librarian";
}

/* -------------------------------------------------------------------------- */
/* Aggregate                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Recompute a book's average and count from the reviews themselves.
 *
 * **One aggregation, and it is the truth.** Incrementing or decrementing a running total is
 * the obvious optimisation and it is wrong: it drifts the moment a write is interrupted
 * between the review and the counter, and there is no way to tell a drifted book from a
 * correct one. `$group` over the reviews cannot drift, so it is the definition.
 *
 * The average is rounded to **one decimal** because `Book.ratingAvg` is what the catalog
 * prints, and storing more precision than is displayed means the card and the detail page
 * can disagree about the same number.
 */
async function recomputeBookRating(
  bookId: Types.ObjectId,
  session: ClientSession,
): Promise<RatingSummary> {
  const [row] = await Review.aggregate<{ average: number; count: number }>([
    { $match: { book: bookId } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]).session(session);

  const count = Number(row?.count ?? 0);
  const average = count > 0 ? Math.round(Number(row.average) * 10) / 10 : 0;

  await Book.updateOne(
    { _id: bookId },
    { $set: { ratingAvg: average, ratingCount: count } },
    { session },
  );

  return { average, count, distribution: [0, 0, 0, 0, 0] };
}

type ReviewRow = {
  _id: Types.ObjectId;
  book: Types.ObjectId;
  member: Types.ObjectId;
  rating: number;
  comment?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The reviews on a book, newest first, plus the rating summary and **the caller's own**.
 *
 * **Public** (spec 15 / `api-contract.md`): a visitor reads reviews, and the summary is the
 * thing they came for. `isMine` / `canModerate` are resolved here from the actor so the
 * component never has to decide who may see an Edit button.
 *
 * **The distribution is aggregated over the whole collection, not the page.** Deriving it
 * from the visible page would make the bars describe whichever ten reviews happened to land
 * on page 1, and the bars would change as a reader pages through — which reads as the
 * ratings themselves changing.
 *
 * `mine` is returned **regardless of which page is showing**, because the composer needs it
 * to offer an edit and a member with more than ten reviews would otherwise find their own
 * review missing from the page they were looking at. Making the client reconstruct it from
 * the rows is exactly the kind of second implementation this codebase keeps removing — and
 * it fails silently, showing an empty composer that quietly creates a second review.
 *
 * Newest first is the right order for a page where the newest opinion is the one that moved
 * the average last. `_id` breaks the tie, because two reviews written in the same
 * millisecond otherwise have no defined order and page 1 and page 2 can disagree.
 */
export async function listReviews(
  bookIdOrSlug: string,
  actor: Actor | null,
  query: ListReviewsQuery,
): Promise<ReviewListResult & { mine: ReviewSummary | null; meta: PageMeta }> {
  if (!Types.ObjectId.isValid(bookIdOrSlug)) {
    throw AppError.notFound("That book could not be found.");
  }

  const bookId = new Types.ObjectId(bookIdOrSlug);
  const book = await Book.findById(bookId).select("title status").lean<{
    title: string;
    status: string;
  }>();

  // Archived books 404 to everyone here, matching `/api/books/:id` — a withdrawn title
  // should not be discoverable through a second route that forgot the rule.
  if (!book || book.status === "archived") {
    throw AppError.notFound("That book could not be found.");
  }

  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));
  const skip = (page - 1) * limit;

  const [total, rows, agg, ownRow] = await Promise.all([
    Review.countDocuments({ book: bookId }),
    Review.find({ book: bookId })
      .select("book member rating comment createdAt updatedAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean<ReviewRow[]>(),
    Review.aggregate<{ _id: number; count: number }>([
      { $match: { book: bookId } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]),
    // The caller's own review, read **independently of the page** so the composer can
    // always find it.
    actor
      ? Review.findOne({ book: bookId, member: actor.id })
          .select("book member rating comment createdAt updatedAt")
          .lean<ReviewRow | null>()
      : Promise.resolve(null),
  ]);

  const members = await User.find({
    _id: { $in: [...rows.map((row) => row.member), ...(actor ? [actor.id] : [])] },
  })
    .select("name avatar")
    .lean<Array<{ _id: Types.ObjectId; name: string; avatar?: CloudinaryImage | null }>>();

  const memberById = new Map(members.map((m) => [String(m._id), m]));
  const actorId = actor ? String(actor.id) : null;

  /** One shared serialiser, so `items` and `mine` cannot describe the same row differently. */
  const toSummary = (row: ReviewRow): ReviewSummary => {
    const member = memberById.get(String(row.member));
    const memberId = String(row.member);

    return {
      id: String(row._id),
      bookId: String(row.book),
      rating: Number(row.rating),
      comment: row.comment ?? null,
      member: {
        id: memberId,
        // A deleted account still has a review. Say "Removed member" rather than
        // crashing on `member.name`, which is what a bare `member.name` would do here.
        name: member ? member.name : "Removed member",
        avatar: member?.avatar ?? null,
      },
      createdAt: (row.createdAt as Date).toISOString(),
      updatedAt: (row.updatedAt as Date).toISOString(),
      isMine: actorId === null ? false : memberId === actorId,
      canModerate: actor ? isStaff(actor.role) : false,
    };
  };

  const items = rows.map(toSummary);

  const distribution: RatingSummary["distribution"] = [0, 0, 0, 0, 0];
  let sum = 0;

  for (const bucket of agg) {
    const index = Math.min(4, Math.max(0, Number(bucket._id) - 1));
    distribution[index] += bucket.count;
    sum += Number(bucket._id) * bucket.count;
  }

  const count = total;
  const summary: RatingSummary = {
    average: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    distribution,
  };

  return {
    summary,
    items,
    mine: ownRow ? toSummary(ownRow) : null,
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

/* -------------------------------------------------------------------------- */
/* Write                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Create or update the caller's own review (business rule 9).
 *
 * ## The order of the checks
 *
 * **Eligibility before anything else**, because it is the rule that is not obvious from the
 * form: a member who has never borrowed the book gets *"Borrow this book to leave a
 * review"* regardless of whether their rating or their comment was well-formed. Validating
 * the payload first would report a length error about a comment they were never allowed to
 * write.
 *
 * ## One endpoint, one row
 *
 * The unique index `{ book, member }` is the real guarantee. This reads for an existing
 * review and updates it, so a second post is an edit — but if two requests race, the loser
 * hits `E11000` and re-reads, so two members cannot end up with two reviews of one book even
 * under a double-click.
 *
 * `ratingAvg` is derived, so it is never accepted from the client (invariant 6 in spirit: the
 * transport layer does not write system-managed numbers).
 */
export async function upsertReview(
  bookIdOrSlug: string,
  actor: Actor,
  input: UpsertReviewInput,
): Promise<ReviewSummary> {
  if (!Types.ObjectId.isValid(bookIdOrSlug)) {
    throw AppError.notFound("That book could not be found.");
  }

  const bookId = new Types.ObjectId(bookIdOrSlug);
  const book = await Book.findById(bookId).select("title status").lean<{ title: string; status: string }>();

  if (!book || book.status === "archived") {
    throw AppError.notFound("That book could not be found.");
  }

  const title = book.title;

  /*
   * A comment of only whitespace is the same as no comment, and the validator has already
   * trimmed it to `""`. Stored as-is it would leave the collection holding two ways of saying
   * "this member rated the book without writing anything" — `null` and `""` — and every
   * `if (review.comment)` check would have to know about both. One representation, decided
   * once, here.
   */
  const comment = input.comment?.trim() ? input.comment.trim() : null;

  /* ------------------------- Eligibility (rule 9) ------------------------- */
  // Any loan, any state. `Loan` has an index on `{ book, member }`-ish paths and this is
  // one indexed `exists`, so it costs nothing.
  const borrowed = await Loan.exists({ book: bookId, member: actor.id });
  if (!borrowed) {
    throw AppError.rule(
      `Borrow “${title}” before leaving a review, so your rating means something.`,
      { rating: "You can review a book once you have borrowed it" },
    );
  }

  /* ------------------------------ The write ------------------------------ */
  return withTransaction(async (session) => {
    const member = await User.findById(actor.id).select("name avatar").session(session).lean<{
      name: string;
      avatar?: CloudinaryImage | null;
    }>();

    const existing = await Review.findOne({ book: bookId, member: actor.id }).session(session);

    let saved;

    if (existing) {
      existing.rating = input.rating;
      // Assigning `undefined` rather than leaving the field alone is deliberate: clearing
      // the comment on an edit must actually clear it, or a member who deletes their words
      // still sees them on the page.
      existing.comment = comment;
      await existing.save({ session });
      saved = existing;
    } else {
      try {
        const [created] = await Review.create(
          [{ book: bookId, member: actor.id, rating: input.rating, comment }],
          { session },
        );
        saved = created;
      } catch (error) {
        // Two clicks raced. The review this member wanted now exists, so adopt it rather
        // than failing a request that succeeded in substance.
        if (!isDuplicateKeyError(error)) throw error;

        const raced = await Review.findOne({ book: bookId, member: actor.id }).session(session);
        if (!raced) throw error;

        raced.rating = input.rating;
        raced.comment = comment;
        await raced.save({ session });
        saved = raced;
      }
    }

    // The aggregate travels with the review (invariant 5).
    await recomputeBookRating(bookId, session);

    await logAudit({
      actor,
      action: existing ? "review.update" : "review.create",
      entityType: "Review",
      entityId: saved._id,
      summary: `${member?.name ?? "A member"} rated “${title}” ${input.rating} out of 5`,
      meta: {
        book: title,
        bookId: String(bookId),
        rating: input.rating,
        hasComment: comment !== null,
      },
      session,
    });

    return {
      id: String(saved._id),
      bookId: String(bookId),
      rating: input.rating,
      comment,
      member: {
        id: String(actor.id),
        name: member?.name ?? "You",
        avatar: member?.avatar ?? null,
      },
      createdAt: saved.createdAt.toISOString(),
      updatedAt: saved.updatedAt.toISOString(),
      isMine: true,
      // Staff who reviewed a book own that review; the moderation control is offered
      // separately by the caller so it is not shown on their own row twice.
      canModerate: isStaff(actor.role),
    };
  });
}

/**
 * Delete a review — its own author, or any staff member moderating.
 *
 * **Owner or staff, decided against the session** (invariant 3). The member comes from the
 * document, never from the request, so there is no id for a caller to tamper with.
 *
 * `recomputes` is reported so a staff member's confirmation can say what actually changed:
 * removing a review drops the book's average and count, and saying "review removed" alone
 * hides the fact that every future card shows a different number.
 */
export async function deleteReview(
  id: string,
  actor: Actor,
): Promise<{ id: string; bookId: string; summary: RatingSummary }> {
  if (!Types.ObjectId.isValid(id)) {
    throw AppError.notFound("That review could not be found.");
  }

  return withTransaction(async (session) => {
    const review = await Review.findById(id).session(session);
    if (!review) throw AppError.notFound("That review could not be found.");

    const owner = String(review.member) === String(actor.id);
    if (!owner && !isStaff(actor.role)) {
      throw AppError.forbidden("You can only remove your own reviews.");
    }

    const [book, member] = await Promise.all([
      Book.findById(review.book).session(session).select("title").lean<{ title: string }>(),
      User.findById(review.member).session(session).select("name").lean<{ name: string }>(),
    ]);

    const title = book?.title ?? "a book";
    const memberName = member?.name ?? "This member";

    await Review.deleteOne({ _id: review._id }, { session });
    const summary = await recomputeBookRating(review.book, session);

    await logAudit({
      actor,
      // A staff removal is moderation and worth distinguishing from a member tidying up
      // their own page — both delete the row, and the audit is the only record of which.
      action: "review.delete",
      entityType: "Review",
      entityId: review._id,
      summary: owner
        ? `${memberName} removed their review of “${title}”`
        : `Removed ${memberName}'s review of “${title}” as a staff member`,
      meta: {
        book: title,
        bookId: String(review.book),
        member: memberName,
        rating: review.rating,
        moderated: !owner,
        // What the book now reads, which is the part an auditor cannot reconstruct.
        ratingAvgAfter: summary.average,
        ratingCountAfter: summary.count,
      },
      session,
    });

    return { id: String(review._id), bookId: String(review.book), summary };
  });
}

/** Mongo `E11000`, raised by the `review_one_per_member_book` index. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}