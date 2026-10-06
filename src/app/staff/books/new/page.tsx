import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { BookForm } from "@/components/features/books/book-form";
import { listCategories, toCategorySummary } from "@/lib/services/categories";

export const metadata: Metadata = {
  title: "Add a book",
  description: "Catalog a new book: cover, description, publication details and copies.",
};

/**
 * Staff page. The layout already enforces the role; this is belt and braces.
 *
 * Categories are read **through the service**, not over HTTP: `code-standards.md`
 * asks Server Components to fetch via services directly, which avoids a pointless
 * round trip to our own API and works during a build.
 *
 * They must then be **serialised** before being handed to `BookForm`, a Client
 * Component. `listCategories()` returns lean Mongoose documents whose `_id` is an
 * `ObjectId`, and React refuses to cross the RSC boundary with anything carrying a
 * `toJSON` — the cast that used to hide this silenced TypeScript and nothing else:
 *
 *   Only plain objects can be passed to Client Components from Server Components.
 *
 * `toCategorySummary` is that conversion, and it is the same one `GET
 * /api/categories` uses, so the server component and the client fetch cannot drift.
 *
 * With no categories the form still renders: its Save button is disabled and the
 * picker explains why, which beats redirecting a staff member away mid-task.
 */
export default async function NewBookPage() {
  await requireStaff();

  const categories = (await listCategories()).map(toCategorySummary);

  return <BookForm book={null} categories={categories} />;
}