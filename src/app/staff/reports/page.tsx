import type { Metadata } from "next";
import { REPORT_TYPES } from "@/lib/constants";
import { ReportsScreen } from "@/components/features/reports/reports-screen";

export const metadata: Metadata = {
  title: "Reports",
  description: "Borrowing, overdue, popular titles, members, fines and inventory.",
};

/**
 * `/staff/reports` — the index, which opens the borrowing report.
 *
 * **It redirects rather than rendering a landing page.** A list of six report descriptions would
 * be one more screen between a librarian and the report they came for, and `ReportNav` already
 * *is* that list — rendered above the report it navigates to. There is nothing a separate index
 * could say that the nav does not already say, with the bonus that the current report is
 * highlighted.
 *
 * `dynamic` is inherited from the staff layout (`force-dynamic`); this route reads no database
 * itself.
 */
export default function ReportsIndexPage() {
  const first = REPORT_TYPES[0];
  return <ReportsScreen initialType={first} />;
}