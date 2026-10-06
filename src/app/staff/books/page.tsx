import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { BooksManager } from "@/components/features/books/books-manager";

export const metadata: Metadata = {
  title: "Books",
  description: "Add, edit, archive and search the catalog.",
};

/** Staff page. The layout already enforces the role; this is belt and braces. */
export default async function BooksPage() {
  await requireStaff();
  return <BooksManager />;
}