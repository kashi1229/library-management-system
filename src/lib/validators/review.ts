import { z } from "zod";
import { PAGINATION } from "@/lib/constants";

/**
 * Wishlist and review validators (spec 15).
 *
 * **Shape only.** Nothing here encodes a policy number — `maxReservationsPerMember` and
 * friends live in the settings singleton — because a `zod` cap would freeze the policy into
 * the transport layer and silently disagree with an admin who changes it (invariant 7).
 */

/** A Mongo ObjectId as a path or query parameter. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** `/api/reviews/:id`. */
export const reviewParamSchema = z.object({ id: objectId });

/** `/api/wishlist/:bookId`. The path names the **book**, not a wishlist row. */
export const wishlistParamSchema = z.object({ bookId: objectId });

/**
 * `POST /api/wishlist` — save a book.
 *
 * The member comes from the session (invariant 3), so the body cannot name a different one.
 */
export const addWishlistSchema = z.object({ bookId: objectId });

/**
 * `POST /api/books/:id/reviews` — create **or update** the caller's own review.
 *
 * One upsert endpoint rather than POST-then-PATCH, because "a member reviews a book once"
 * is enforced by the `review_one_per_member_book` unique index: a second POST must *update*
 * that row, and having the client decide which of the two it is asking for is how a member
 * ends up with two reviews of one book.
 *
 * `rating` is `z.coerce`d because a native number input or a `<fieldset>` of radios can
 * hand the form a **number** or a **string** depending on how it was read. Declaring it a
 * plain `z.number()` is the Unit 08 "edit form can never be saved" bug.
 */
export const upsertReviewSchema = z.object({
  rating: z.coerce
    .number()
    .int("Choose a whole number of stars")
    .min(1, "Choose at least one star")
    .max(5, "Five stars is the maximum"),
  comment: z
    .string()
    .trim()
    .max(1000, "Keep your review under 1000 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

const pageQuery = z.coerce
  .number()
  .int()
  .min(1)
  .max(100000)
  .optional()
  .default(PAGINATION.defaultPage);

const limitQuery = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGINATION.maxLimit)
  .optional()
  .default(PAGINATION.defaultLimit);

/**
 * `GET /api/books/:id/reviews` — **public**.
 *
 * Visitors read reviews; they cannot write one. The summary is always present so the
 * distribution bars render even on page 3 of an empty result.
 */
export const listReviewsQuerySchema = z.object({
  page: pageQuery,
  limit: limitQuery,
});

export type UpsertReviewInput = z.infer<typeof upsertReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;