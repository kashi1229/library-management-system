import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { BookForm } from "@/components/features/books/book-form";
import { listCategories, toCategorySummary } from "@/lib/services/categories";
import { getBook } from "@/lib/services/books";
import { notFound } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;

  try {
    const book = await getBook(id);
    return {
      title: `Edit ${book.title}`,
      description: `Update the catalog record for ${book.title}.`,
    };
  } catch {
    return { title: "Book not found" };
  }
}

/**
 * Staff edit page (spec 08).
 *
 * Read on the server and handed to the client form as a prop, so the fields are
 * populated on first paint — no fetch-then-fill flash, and `isDirty` is true
 * against the values that were actually loaded.
 *
 * `requireStaff()` runs here as well as in the layout: defence in depth, and it
 * also means an anonymous request never reaches the database read.
 */
/**
 * Resolve a book, or `null` when it does not exist.
 *
 * `getBook` throws `AppError` for a missing id, which is right for the API but
 * wrong for a page: a page wants the 404 boundary, not an exception. Wrapping the
 * lookup here keeps the page from having to know about error codes.
 */
async function getBookOrNull(id: string) {
  try {
    return await getBook(id);
  } catch {
    return null;
  }
}

export default async function EditBookPage({ params }: Params) {
  await requireStaff();

  const { id } = await params;

  const [categories, book] = await Promise.all([
    listCategories().then((items) => items.map(toCategorySummary)),
    // `notFound()` throws, so it must not sit inside a `Promise.all` branch that
    // would otherwise reject with a different error and mask the 404.
    getBookOrNull(id),
  ]);

  if (!book) notFound();

  return <BookForm book={book} categories={categories} />;
}