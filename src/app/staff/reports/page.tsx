import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Reports",
  description: "Borrowing, overdue, popular titles, fines and inventory.",
};

export default async function ReportsPage() {
  return (
    <PlaceholderPage
      title="Reports"
      description="Borrowing, overdue, popular titles, fines and inventory."
      icon={BarChart3}
      unit={18}
    />
  );
}
