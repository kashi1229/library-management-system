import type { Metadata } from "next";
import { BookMarked } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "My Loans",
  description: "Books you have borrowed, with due dates and renewal options.",
};

export default async function MyLoansPage() {
  return (
    <PlaceholderPage
      title="My Loans"
      description="Books you have borrowed, with due dates and renewal options."
      icon={BookMarked}
      unit={12}
    />
  );
}
