import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Reservations",
  description: "Manage holds, fulfil reservations and clear queues.",
};

export default async function ReservationsPage() {
  return (
    <PlaceholderPage
      title="Reservations"
      description="Manage holds, fulfil reservations and clear queues."
      icon={Clock}
      unit={14}
    />
  );
}
