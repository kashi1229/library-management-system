import type { Metadata } from "next";
import { MembersManager } from "@/components/features/members/members-manager";

export const metadata: Metadata = {
  title: "Members",
  description: "Search, review, suspend and activate library members.",
};

/**
 * Staff member register (spec 10).
 *
 * Kept a Server Component so the layout's auth guard applies, then hands straight to
 * the client manager. The guard is in the layout (`requireStaff()`), so repeating it
 * here would be a second place to forget to update.
 */
export default async function MembersPage() {
  return <MembersManager />;
}
