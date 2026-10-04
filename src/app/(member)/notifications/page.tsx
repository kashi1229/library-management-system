import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Loan updates, reservation holds and account activity.",
};

export default async function NotificationsPage() {
  return (
    <PlaceholderPage
      title="Notifications"
      description="Loan updates, reservation holds and account activity."
      icon={Bell}
      unit={16}
    />
  );
}
