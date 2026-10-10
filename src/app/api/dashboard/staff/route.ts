import { handler, ok } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { getStaffDashboard } from "@/lib/services/dashboard";
import { runMaintenanceIfDue } from "@/lib/services/maintenance";

/**
 * GET /api/dashboard/staff — the whole library at a glance.
 *
 * **`requireStaff()`** — this is the only guard, and the data itself is unscoped by design:
 * a librarian's dashboard is the library's, not theirs.
 *
 * **The lazy maintenance sweep is fired here and never awaited into the response.** It is
 * throttled to ten minutes on `Settings.lastMaintenanceAt`, so for a librarian on the desk
 * this is one indexed read and a return. When it *is* due it does real work, and that must not
 * sit in front of the page they are looking at while somebody waits at the counter.
 *
 * The call is detached with its own `.catch` rather than being left to float: `handler()` turns
 * a rejection into a 500, and a background job must never be able to fail the dashboard. The
 * same sweep also fires from the staff layout (Unit 16) — twice is harmless and free, because
 * the throttle makes the second caller a no-op.
 */
export const GET = handler(async () => {
  await requireStaff();

  void runMaintenanceIfDue().catch(() => {});

  const dashboard = await getStaffDashboard();

  return ok(dashboard);
}, { name: "GET /api/dashboard/staff" });