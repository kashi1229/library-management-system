import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/common/placeholder-page";

export const metadata: Metadata = {
  title: "Reservations",
  description: "Books you are waiting for and holds ready to collect.",
};

export default async function ReservationsPage() {
  return (
    <PlaceholderPage
      title="Reservations"
      description="Books you are waiting for and holds ready to collect."
      icon={Clock}
      unit={14}
    />
  );
}
