import type { Metadata } from "next";
import { ReservationsManager } from "@/components/features/reservations/reservations-manager";

export const metadata: Metadata = {
  title: "Reservations",
  description: "Manage holds, fulfil reservations and clear queues.",
};

/**
 * The staff reservation register (spec 14).
 *
 * The layout already enforces `requireStaff()`, and the register is entirely client state
 * (tab, SWR, the two action dialogs), so this stays a thin Server Component rather than
 * reading anything on the server first.
 */
export default function StaffReservationsPage() {
  return <ReservationsManager />;
}