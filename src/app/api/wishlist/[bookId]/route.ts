import { handler, ok, parseParams } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { removeFromWishlist } from "@/lib/services/wishlist";
import { wishlistParamSchema } from "@/lib/validators/review";

/**
 * DELETE /api/wishlist/:bookId — unsave a book.
 *
 * **The path names the book, not a wishlist row.** The heart sits on a book card, so the id
 * the caller already holds is the book's; making it fetch the row id first would be a round
 * trip to learn something it could have been told.
 *
 * The member comes from the session (invariant 3) and scopes the delete, so this can only
 * ever remove the caller's **own** save — there is no id here for a caller to point at
 * somebody else's row.
 *
 * Removing a book that is not saved succeeds. The heart is a toggle and the client updates
 * optimistically, so a member who taps twice must not get an error over a state that is
 * already correct.
 */
export const DELETE = handler(async (_request, { params }) => {
  const { user } = await requireSession();
  const { bookId } = await parseParams(wishlistParamSchema, params);

  const result = await removeFromWishlist(bookId, user.id);

  return ok(result);
}, { name: "DELETE /api/wishlist/:bookId" });