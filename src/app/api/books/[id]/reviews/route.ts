import { Types } from "mongoose";
import { z } from "zod";
import { handler, ok, parseBody, parseParams, parseQuery } from "@/lib/api";
import { getSession, requireActiveMember } from "@/lib/auth/session";
import { listReviews, upsertReview } from "@/lib/services/reviews";
import { listReviewsQuerySchema, upsertReviewSchema } from "@/lib/validators/review";

/**
 * `/api/books/:id/reviews` — the path id is the **book's**, and reviews are keyed by book.
 * A slug is refused rather than resolved: this route is reached from a detail page that
 * already has the id, and silently accepting a slug would mean one more lookup on a path
 * that has no reason to be ambiguous.
 */
const bookIdParamSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") });

/**
 * GET /api/books/:id/reviews — **public** (F10, spec 15).
 *
 * A visitor reads reviews and the rating summary; that is the point of publishing them.
 * `getSession()` is used rather than `requireSession()` precisely so this stays open — an
 * anonymous caller gets `isMine: false` and `canModerate: false` on every row, which is
 * what the component needs to decide which controls to render.
 *
 * The reading is done **from the cookie only** (no database round trip) because this is a
 * public page: a visitor should not pay a user query for a page they can read signed out,
 * and the session id it does return is all the ownership check needs.
 */
export const GET = handler(async (request, { params }) => {
  const { id } = await parseParams(bookIdParamSchema, params);
  const query = parseQuery(listReviewsQuerySchema, request);

  const session = await getSession().catch(() => null);
  const actor = session
    ? { id: new Types.ObjectId(session.sub), role: session.role }
    : null;

  const { summary, items, mine, meta } = await listReviews(id, actor, query);

  return ok({ summary, items, mine }, meta);
}, { name: "GET /api/books/:id/reviews" });

/**
 * POST /api/books/:id/reviews — create or update the caller's own review (business rule 9).
 *
 * `requireActiveMember()`: a suspended member may read reviews and edit their profile, but
 * reviewing is publishing under their name, so it is treated like the other member
 * contributions. `architecture.md` explicitly exempts wishlist and profile edits — not
 * reviews — from a suspension.
 */
export const POST = handler(async (request, { params }) => {
  const { id } = await parseParams(bookIdParamSchema, params);
  const { actor } = await requireActiveMember();

  const input = await parseBody(upsertReviewSchema, request);
  const review = await upsertReview(id, actor, input);

  return ok({ review });
}, { name: "POST /api/books/:id/reviews" });