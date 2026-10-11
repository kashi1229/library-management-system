import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { REPORT_META, REPORT_TYPES, type ReportType } from "@/lib/constants";
import { ReportsScreen } from "@/components/features/reports/reports-screen";

type Params = { params: Promise<{ type: string }> };

/**
 * Per-report metadata, resolved from the report definition.
 *
 * **`generateMetadata` reads nothing from the database** — the title and description are already
 * declared in `REPORT_META` in `@/lib/constants`.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { type } = await params;
  if (!REPORT_TYPES.includes(type as ReportType)) {
    return { title: "Report not found" };
  }

  const meta = REPORT_META[type as ReportType];
  return {
    title: meta.label,
    description: meta.blurb,
  };
}

/**
 * `/staff/reports/[type]` — one of the six reports.
 *
 * **The role check is the layout's**, exactly as `/staff/reports` leaves it: the staff layout
 * already calls `requireStaff()` on every `/staff` route, and this page reads no database itself —
 * it renders the client shell, which fetches from the guarded API. `GET /api/reports/:type` is
 * where authorisation is actually enforced, and it is enforced twice over (here and there).
 *
 * **An unknown type 404s rather than falling back to the borrowing report.** Falling back would
 * make a typo in a shared link silently show the wrong report with the right URL, which is worse
 * than an error page.
 */
export default async function ReportPage({ params }: Params) {
  const { type } = await params;
  if (!REPORT_TYPES.includes(type as ReportType)) {
    notFound();
  }

  return <ReportsScreen initialType={type as ReportType} />;
}