import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession, toPublicUser, type AuthenticatedUser } from "@/lib/auth/session";
import { User } from "@/models";
import { getSettings } from "@/lib/services/settings";

/**
 * Member area shell.
 *
 * The session user is resolved **on the server** and handed to `AppShell`, so
 * the shell never fetches and there is no auth flash on first paint. Middleware
 * already gates these routes; `requireSession()` is the real enforcement and a
 * missing session redirects rather than throwing.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  let session: AuthenticatedUser | null = null;

  try {
    session = (await requireSession()).user;
  } catch {
    session = null;
  }

  if (!session) redirect("/login");

  // Re-read the full record so the shell can show the avatar and the suspension
  // reason without a second round trip. The settings read is best-effort: a
  // missing database should not block a signed-in user from reaching a page.
  const [full, settings] = await Promise.all([
    User.findById(session.id)
      .select("name email role membershipId phone department avatar status suspendedReason lastLoginAt createdAt")
      .lean(),
    getSettings().catch(() => null),
  ]);

  if (!full) redirect("/login");

  // `/profile` is reachable by every role, so pick the shell that matches the
  // visitor — a librarian checking their profile keeps the staff navigation
  // instead of being dropped into the member shell.
  const variant = full.role === "librarian" || full.role === "admin" ? "staff" : "member";

  return (
    <AppShell user={toPublicUser(full)} variant={variant} libraryName={settings?.libraryName}>
      {children}
    </AppShell>
  );
}
