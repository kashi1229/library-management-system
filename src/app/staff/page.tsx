import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { StaffDashboard } from "@/components/features/dashboard/staff-dashboard";
import { getStaffDashboard } from "@/lib/services/dashboard";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Staff Dashboard",
  description: "Today's issues and returns, overdue count, ready holds and low stock.",
};

/**
 * **Never statically prerendered.**
 *
 * This route has no `params`, so Next tries to prerender it at build time — and it is the first
 * page in this app that reads the database while rendering. The build failed on it with
 * `MongooseError: books.aggregate() buffering timed out`, because at build time there is no
 * request, no cookie and therefore no `requireStaff()` to have called `connectDB()`.
 *
 * `/staff` is per-request by definition: the numbers are live circulation figures and the whole
 * page only exists behind a session. `dynamic = "force-dynamic"` says so explicitly, matching
 * `app/(public)/catalog/page.tsx`, which had to opt out for the same class of reason.
 */
export const dynamic = "force-dynamic";

/**
 * The staff dashboard.
 *
 * **The service is called directly, not through `/api/dashboard/staff`.** Per `code-standards.md`
 * a read belongs in a Server Component when it can, and this one can: it needs no client
 * interactivity, no revalidation and no second caller. Going over HTTP would add a round trip and
 * a chance for the page and the API to disagree about the same numbers.
 *
 * **`requireStaff()` is called here as well as in the layout.** The layout guards the section;
 * this page reads the whole library's data, so it asserts access itself — the same
 * defence-in-depth `app/staff/members/[id]/page.tsx` uses. It is also what guarantees
 * `connectDB()` has run before the aggregation: layout and page render concurrently, so
 * relying on the layout's connection would be a race that only fails on a cold process.
 *
 * **No `runMaintenanceIfDue()` on this page.** The staff layout already fires it on every staff
 * screen, and the API route fires it for anyone calling the JSON. A third trigger on the one
 * page that is already inside two would be three chances to double-sweep.
 */
export default async function StaffDashboardPage() {
  await requireStaff();

  const data = await getStaffDashboard();

  return (
    <div className="container-page space-y-8">
      <PageHeader
        title="Dashboard"
        description="The library at a glance: what is out, what is late, and what is waiting at the desk."
      />
      <StaffDashboard data={data} />
    </div>
  );
}