import type { Metadata } from "next";
import { MyReservations } from "@/components/features/reservations/my-reservations";

export const metadata: Metadata = {
  title: "Reservations",
  description: "Books you are waiting for and holds ready to collect.",
};

/**
 * A member's own holds (spec 14).
 *
 * A thin Server Component over a client page: the layout already resolves the session, and
 * the whole screen is client state (SWR plus the cancel dialog).
 *
 * **No `searchParams`.** Reading them would force `export const dynamic = "force-dynamic"`
 * for a page with no URL-driven filters, and the three sections are not tabs — they are
 * one grouped list, which is what a member with one ready hold and two queues needs to see
 * at a glance.
 */
export default function ReservationsPage() {
  return <MyReservations />;
}