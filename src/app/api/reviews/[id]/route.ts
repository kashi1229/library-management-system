import { handler, ok, parseParams } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { deleteReview } from "@/lib/services/reviews";
import { reviewParamSchema } from "@/lib/validators/review";

/**
 * DELETE /api/reviews/:id — remove a review.
 *
 * `requireSession()` rather than a role guard, because **the author and staff are both
 * allowed and the service is what tells them apart** — it compares the review's member
 * against the session id and returns 403 otherwise (invariant 3). A route-level
 * `requireStaff()` would stop members tidying up their own page, and trusting a
 * client-supplied "is this mine" would let anyone remove anything.
 *
 * **A staff removal is audited as moderation**, with the member's name and what the book's
 * rating became afterwards. Deleting the row is the easy part; the audit row is the only
 * record of who took a review down and what it did to the average.
 *
 * The response carries the recomputed `summary` so the confirmation can say what actually
 * changed rather than a bare "removed".
 */
export const DELETE = handler(async (_request, { params }) => {
  const { actor } = await requireSession();
  const { id } = await parseParams(reviewParamSchema, params);

  const { summary } = await deleteReview(id, actor);

  return ok({ summary });
}, { name: "DELETE /api/reviews/:id" });