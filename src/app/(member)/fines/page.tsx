import type { Metadata } from "next";
import { MyFines } from "@/components/features/fines/my-fines";

export const metadata: Metadata = {
  title: "Fines",
  description: "Outstanding balances and a full payment history.",
};

/**
 * A member's own fines (spec 13).
 *
 * A thin Server Component over a client page: the layout already resolves the session, and
 * the list is entirely client state (tab, debounced search, SWR).
 *
 * No `searchParams` here — reading them would force `export const dynamic =
 * "force-dynamic"` for a page that has no URL-driven filters, and the tab lives in the
 * list's own state on purpose.
 */
export default function FinesPage() {
  return <MyFines />;
}