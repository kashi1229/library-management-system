import { handler, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { getMemberDashboard } from "@/lib/services/dashboard";

/**
 * GET /api/dashboard/member — the member's own dashboard.
 *
 * **`requireSession()`, not `requireActiveMember()`**: a suspended member may still sign in and
 * read, and the dashboard is the first screen they meet — refusing it would lock a suspended
 * member out of their own reading history and their fine balance, which is exactly what they
 * need in order to find out why they were suspended.
 *
 * **The member id comes from the session and there is no query parameter**, so the URL cannot
 * be edited to read somebody else's dashboard (invariant 3). The scoping is additionally
 * enforced inside the service, so a future caller cannot skip it.
 */
export const GET = handler(async () => {
  const { actor } = await requireSession();

  const dashboard = await getMemberDashboard(actor.id);

  return ok(dashboard);
}, { name: "GET /api/dashboard/member" });