import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { TeamManager } from "@/components/features/team/team-manager";

export const metadata: Metadata = {
  title: "Team",
  description: "Create and manage librarian and administrator accounts.",
};

/**
 * Staff account administration (spec 10). **Admin only.**
 *
 * The guard stays on the page, unchanged from the placeholder: a librarian hitting
 * this URL is sent to their own home rather than shown an empty list, and every route
 * under `/api/team` calls `requireAdmin()` independently.
 *
 * `requireAdmin()` returns the signed-in admin, and their id is passed down so
 * `TeamManager` can mark the "You" badge and disable the two actions that would let an
 * admin lock themselves — or the last admin — out of staff management. Those rules are
 * enforced server-side; the prop only stops the buttons being offered at all.
 */
export default async function TeamPage() {
  let adminId: string;

  try {
    const { user } = await requireAdmin();
    // `AuthenticatedUser.id` is a Mongoose `ObjectId` (it has to be, to query with).
    // `TeamManager` compares it against string ids coming off the API, so it is
    // stringified here rather than with an `as string` cast.
    adminId = user.id.toString();
  } catch {
    redirect(ROLE_HOME.member);
  }

  return <TeamManager currentUserId={adminId} />;
}
