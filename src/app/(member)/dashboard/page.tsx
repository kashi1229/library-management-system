import type { Metadata } from "next";
import { getMemberDashboard } from "@/lib/services/dashboard";
import { getSettings } from "@/lib/services/settings";
import { requireSession } from "@/lib/auth/session";
import { GreetingHeader } from "@/components/features/dashboard/greeting-header";
import { MemberDashboard } from "@/components/features/dashboard/member-dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your loans, holds, fines and reading history at a glance.",
};

/**
 * **Never statically prerendered.**
 *
 * Every figure below is that member's own live loans, holds and fines, and the page only exists
 * behind a session — there is nothing about it that could be baked at build time. Next would
 * otherwise attempt to prerender this route (it has no `params`), which is what broke
 * `app/staff/page.tsx` during the build with a Mongoose buffering timeout. Declared explicitly
 * rather than left to the `cookies()` call inside `requireSession()` being detected, because the
 * staff layout's `try/catch` around that same call swallows the signal — see the note on
 * `app/staff/layout.tsx`.
 */
export const dynamic = "force-dynamic";

/**
 * The member dashboard.
 *
 * **`requireSession()`, not `requireActiveMember()`.** A suspended member can still sign in and
 * read, and this is the first screen they meet — refusing it would hide the loan history and the
 * fine balance, which are exactly the two things they need in order to work out why they were
 * suspended. The middleware already gates the `(member)` group on a cookie; this is the
 * server-side guarantee, and it re-reads the user from the database rather than trusting the
 * token (invariant 2).
 *
 * **`getSettings()` for the loan period, not a guess.** The countdown ring scales its arc against
 * the maximum, and that maximum is policy — read here and passed down, so a ring on this page and
 * a ring on My Loans are the same size for the same number of days left.
 *
 * **The service is called directly rather than through `/api/dashboard/member`.** A read with no
 * interactivity belongs in a Server Component; going over HTTP would add a round trip and give
 * the page and the API the chance to disagree about the same numbers.
 */
export default async function MemberDashboardPage() {
  const { actor, user } = await requireSession();

  const [dashboard, settings] = await Promise.all([
    getMemberDashboard(actor.id),
    // Policy is display-only here; a failure to read it must not blank the whole page, and the
    // fallback matches the documented default so the rings still scale sensibly.
    getSettings().catch(() => null),
  ]);

  return (
    <div className="container-page space-y-8">
      {/* `user.name`, not the JWT's `name` claim: `requireSession` re-reads the user from the
          database, so this is the name on record rather than a name a stale token still carries.
          `actor` is deliberately only `{ id, role }` — it is the audit-trail identity, not a
          profile. */}
      <GreetingHeader name={user.name} />
      <MemberDashboard data={dashboard} loanPeriod={settings?.loanPeriodDays ?? 14} />
    </div>
  );
}