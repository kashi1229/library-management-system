import type { Metadata } from "next";
import { CirculationDesk } from "@/components/features/circulation/circulation-desk";

export const metadata: Metadata = {
  title: "Circulation",
  description: "Issue, return and renew books at the desk.",
};

/**
 * The librarian's circulation desk (spec 12).
 *
 * A thin Server Component: the layout already enforces `requireStaff()`, and the desk
 * itself is entirely client state (two selectors, a ticket, a filterable table). Reading
 * anything on the server first would only add a loading step before the same data is
 * fetched client-side.
 *
 * `initialMemberId` arrives from the Unit 10 member record's "Issue a book" action, so a
 * librarian reading a member can go straight to issuing without re-typing them. Read here
 * and passed as a prop rather than via `useSearchParams` in the client component, which
 * would force `export const dynamic = "force-dynamic"` on the route (the Unit 09 lesson).
 */
export default async function CirculationPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { memberId } = await searchParams;

  return <CirculationDesk initialMemberId={memberId} />;
}