import { handler, ok, parseBody } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { addToWishlist, listWishlist } from "@/lib/services/wishlist";
import { addWishlistSchema } from "@/lib/validators/review";

/**
 * GET /api/wishlist — the signed-in user's saved books.
 *
 * **No member id and no filters** (invariant 3): the member comes from the session, so the
 * URL cannot be edited to read somebody else's reading list.
 *
 * A suspended member keeps their wishlist. Being suspended stops them borrowing, not
 * saving books for later, and `architecture.md` says wishlist edits remain allowed.
 */
export const GET = handler(async () => {
  const { user } = await requireSession();

  const items = await listWishlist(user.id);

  return ok({ items });
}, { name: "GET /api/wishlist" });

/**
 * POST /api/wishlist — save a book. **Idempotent.**
 *
 * Idempotent because the heart is a *toggle*: a double-click, a retry, or a React handler
 * firing twice must not leave the member unable to remove the book again. Saving a book that
 * is already saved returns **200 with the existing row**, not a 409 — the state the caller
 * asked for is the state they now have, and a conflict they cannot act on is the worst
 * possible answer to an idempotent write.
 *
 * Only `bookId` is accepted; the member comes from the session.
 */
export const POST = handler(async (request) => {
  const { actor } = await requireSession();

  const { bookId } = await parseBody(addWishlistSchema, request);
  const item = await addToWishlist(bookId, actor);

  return ok({ item });
}, { name: "POST /api/wishlist" });