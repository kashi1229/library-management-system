import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your loans, holds, fines and reading history at a glance.",
};

export default async function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      description="Your loans, holds, fines and reading history at a glance."
      icon={LayoutDashboard}
      unit={17}
    />
  );
}
