import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Books",
  description: "Add, edit, archive and search the catalog.",
};

export default async function BooksPage() {
  return (
    <PlaceholderPage
      title="Books"
      description="Add, edit, archive and search the catalog."
      icon={BookOpen}
      unit={8}
    />
  );
}
