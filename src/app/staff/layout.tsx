import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireStaff, toPublicUser, type AuthContext } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { User } from "@/models";
import { getSettings } from "@/lib/services/settings";

/**
 * Staff area shell.
 *
 * This role check is **redundant with middleware on purpose**: middleware is a
 * coarse first gate, and the layout is the server-side guarantee that no staff
 * page ever renders for a member. A librarian reaching an admin-only URL is sent
 * to the staff dashboard, matching the middleware redirect.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  let context: AuthContext | null = null;

  try {
    context = await requireStaff();
  } catch {
    context = null;
  }

  if (!context) redirect(ROLE_HOME.member);

  const [full, settings] = await Promise.all([
    User.findById(context.user.id)
      .select("name email role membershipId phone department avatar status suspendedReason lastLoginAt createdAt")
      .lean(),
    getSettings().catch(() => null),
  ]);

  if (!full) redirect("/login");

  return (
    <AppShell user={toPublicUser(full)} variant="staff" libraryName={settings?.libraryName}>
      {children}
    </AppShell>
  );
}
