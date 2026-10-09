import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireStaff, toPublicUser, type AuthContext } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { User } from "@/models";
import { getSettings } from "@/lib/services/settings";
import { runMaintenanceIfDue } from "@/lib/services/maintenance";

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
    /*
     * The spec's throttled lazy maintenance run, fired from the staff layout (spec 16).
     *
     * **Not awaited into the render path's critical promise list and never allowed to fail the
     * page.** `runMaintenanceIfDue` reads `lastMaintenanceAt`, and on a dashboard that is
     * visited more than once in ten minutes that is one indexed read and nothing else — so it is
     * cheap to attempt on every load. When it *is* due it does real work, and that must not sit
     * in front of the page a librarian is waiting for; hence the detached promise with an
     * explicit catch. The alternative — awaiting it — turns a background job into a slow page,
     * which is how background jobs get turned off.
     *
     * It is placed here rather than on the dashboard page so the sweep happens for every staff
     * screen, which is the point of "lazy": there is no cron in this deployment.
     */
    runMaintenanceIfDue().catch(() => {}),
  ]);

  if (!full) redirect("/login");

  return (
    <AppShell user={toPublicUser(full)} variant="staff" libraryName={settings?.libraryName}>
      {children}
    </AppShell>
  );
}
