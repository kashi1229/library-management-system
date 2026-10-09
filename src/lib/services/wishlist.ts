import "server-only";
import { Types } from "mongoose";
import { AppError } from "@/lib/api";
import { Book, Wishlist } from "@/models";
import { catalogBookFor, listCatalogBooksByIds } from "@/lib/services/books";
import type { Actor, WishlistItem } from "@/types";

/**
 * Wishlist service (F10, spec 15).
 *
 * Three operations, and the only non-trivial decision is what "saved" means for a book that
 * is later **archived**. Archiving is not deletion — the book keeps its loans, its reviews
 * and its history — so a member who saved it should still find it. It simply stops being
 * reservable, and that is `effectiveAvailable: 0` plus a badge rather than a 404.
 */

/**
 * The member's saved books, newest save first.
 *
 * **The books are fetched through the catalog reader**, not read straight off the
 * `wishlist` collection, so a saved book looks exactly like it does everywhere else: same
 * cover, same category accent, same `effectiveAvailable` that already subtracts ready holds.
 * Reading the raw rows would mean a second definition of "is this available", and the
 * wishlist is precisely where a member looks before deciding to reserve.
 *
 * Ids the catalog no longer returns (a book hard-deleted after being saved — `deleteBook`
 * refuses once it has history, so this is rare) are dropped rather than rendered as
 * placeholders: a saved book that no longer exists is not something the member can act on,
 * and a grid of "No longer in the catalog" cards is not a reading list.
 */
export async function listWishlist(memberId: Types.ObjectId): Promise<WishlistItem[]> {
  const rows = await Wishlist.find({ member: memberId })
    .sort({ createdAt: -1, _id: -1 })
    .select("book createdAt")
    .lean<Array<{ _id: Types.ObjectId; book: Types.ObjectId; createdAt: Date }>>();

  if (rows.length === 0) return [];

  const books = await listCatalogBooksByIds(rows.map((row) => row.book));

  return rows.flatMap((row) => {
    const book = books.get(String(row.book));
    if (!book) return [];
    return [{ id: String(row._id), book, savedAt: row.createdAt.toISOString() }];
  });
}

/**
 * Save a book. **Idempotent** (spec 15).
 *
 * Idempotency is not politeness here, it is correctness: the heart is a *toggle*, and a
 * double-click, a retry after a dropped connection, or React firing the handler twice must
 * not leave the member unable to remove the book again. An insert that hits
 * `wishlist_unique` is therefore **treated as success**, not as a 409 — the state the
 * caller asked for is the state they now have.
 *
 * Refuses an archived book, because a reading list of books that cannot be borrowed or
 * reserved is a promise the catalog cannot keep.
 */
export async function addToWishlist(bookId: string, actor: Actor): Promise<WishlistItem> {
  if (!Types.ObjectId.isValid(bookId)) {
    throw AppError.notFound("That book could not be found.");
  }

  const id = new Types.ObjectId(bookId);
  const book = await Book.findById(id).select("title status").lean<{ title: string; status: string }>();

  if (!book) throw AppError.notFound("That book could not be found.");

  if (book.status === "archived") {
    throw AppError.rule(`“${book.title}” is archived, so it cannot be added to your reading list.`, {
      bookId: "This book is archived",
    });
  }

  const [existing] = await Wishlist.find({ member: actor.id, book: id })
    .select("_id createdAt")
    .lean<Array<{ _id: Types.ObjectId; createdAt: Date }>>();

  if (existing) {
    return { id: String(existing._id), book: await catalogBookFor(id), savedAt: existing.createdAt.toISOString() };
  }

  try {
    const [created] = await Wishlist.create([{ member: actor.id, book: id }]);
    return {
      id: String(created._id),
      book: await catalogBookFor(id),
      savedAt: created.createdAt.toISOString(),
    };
  } catch (error) {
    // A concurrent double-submit hit the unique index. The row the caller wanted exists,
    // so re-read it and report success rather than a conflict they cannot act on.
    if (!isDuplicateKeyError(error)) throw error;

    const [raced] = await Wishlist.find({ member: actor.id, book: id })
      .select("_id createdAt")
      .lean<Array<{ _id: Types.ObjectId; createdAt: Date }>>();

    if (!raced) throw error;

    return {
      id: String(raced._id),
      book: await catalogBookFor(id),
      savedAt: raced.createdAt.toISOString(),
    };
  }
}

/**
 * Remove a book from the wishlist.
 *
 * **Removing something that is not there succeeds.** The heart is a toggle and the client
 * toggles optimistically, so a member who taps remove twice must not get an error toast
 * over a state that is already correct.
 */
export async function removeFromWishlist(bookId: string, memberId: Types.ObjectId): Promise<{ id: string }> {
  if (!Types.ObjectId.isValid(bookId)) {
    throw AppError.notFound("That saved book could not be found.");
  }

  // Scoped to `memberId` — from the session, never from the body (invariant 3). Without the
  // scope this would delete *anybody's* save of that book.
  const deleted = await Wishlist.findOneAndDelete({
    member: memberId,
    book: new Types.ObjectId(bookId),
  }).lean<{ _id: Types.ObjectId } | null>();

  return { id: deleted ? String(deleted._id) : bookId };
}

/** Mongo `E11000`, raised by the `wishlist_unique` index. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}