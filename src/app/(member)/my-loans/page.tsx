import type { Metadata } from "next";
import { MyLoans } from "@/components/features/circulation/my-loans-page";

export const metadata: Metadata = {
  title: "My Loans",
  description: "Books you have borrowed, with due dates and renewal options.",
};

/**
 * The member's own loans (spec 12).
 *
 * A thin Server Component over a client page: the layout already resolves the session, and
 * the list is entirely client state (tab, SWR, optimistic renewals). Reading loans on the
 * server first would mean loading data that the client immediately refetches.
 *
 * No `searchParams` here, deliberately — reading them would force
 * `export const dynamic = "force-dynamic"` for a page that has no filters.
 */
export default function MyLoansPage() {
  return <MyLoans />;
}