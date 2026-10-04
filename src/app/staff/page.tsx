import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Staff Dashboard",
  description: "Today's issues and returns, overdue count, ready holds and low stock.",
};

export default async function StaffDashboardPage() {
  return (
    <PlaceholderPage
      title="Staff Dashboard"
      description="Today's issues and returns, overdue count, ready holds and low stock."
      icon={LayoutDashboard}
      unit={17}
    />
  );
}
