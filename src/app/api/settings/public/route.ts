import { handler, ok } from "@/lib/api";
import { getPublicSettings } from "@/lib/services/settings";

/**
 * GET /api/settings/public — **public, no authentication**.
 *
 * The circulation desk and "My Loans" both have to *show* policy numbers before a loan
 * exists: the issue ticket previews a due date, and a disabled Renew button says "2 of 2
 * renewals used". Neither can hard-code them (invariant 7 — an admin changes the policy
 * in Settings and every screen has to follow), and neither can be served a staff-only
 * endpoint, because "My Loans" belongs to a member.
 *
 * So this exposes a **deliberately narrow subset**: the seven values a reader can be shown
 * without seeing anything administrative. Deliberately absent — `contactEmail`,
 * `fineBlockThreshold`, `maxFinePerLoan`, `lastMaintenanceAt`, and every other operational
 * field. It is a display endpoint, not a settings dump; widening it is a decision, not a
 * convenience.
 *
 * `getPublicSettings()` picks the fields explicitly, so a field added to `SettingDoc` later
 * is not exposed by accident.
 */
export const GET = handler(
  async () => ok(await getPublicSettings()),
  // No `requireSession`: the values are public by design. `connectDB` still runs.
  { name: "GET /api/settings/public", skipDb: false },
);