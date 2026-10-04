import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession, toPublicUser } from "@/lib/auth/session";
import { User } from "@/models";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your library account details, photo and password.",
  robots: { index: false, follow: false },
};

/**
 * `/profile` is reachable by **every** role (the topbar account menu links here
 * for staff too), so the record is resolved from the session and rendered by the
 * shared client rather than assumed to be a member.
 */
export default async function ProfilePage() {
  const { user } = await requireSession();

  const full = await User.findById(user.id)
    .select("name email role membershipId phone department avatar status suspendedReason lastLoginAt createdAt")
    .lean();

  // `requireSession()` guarantees the account exists, so `full` is always found.
  if (!full) redirect("/login");

  return <ProfileView user={toPublicUser(full)} />;
}
