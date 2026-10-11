import { handler, ok, parseParams, parseQuery } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { csvFilename, getReport, toCsv } from "@/lib/services/reports";
import { reportQuerySchema, reportTypeSchema } from "@/lib/validators/report";

/**
 * GET /api/reports/:type — one of the six staff reports, as JSON or as CSV.
 *
 * **`requireStaff()`** — a report is the whole library's data, and `api-contract.md` marks it `S`.
 * A member gets 403 before a single aggregate runs.
 *
 * **`format=csv` returns a raw `Response`, not the envelope.** `handler()` wraps thrown errors and
 * nothing else, so returning `new Response(...)` passes straight through — which is what a file
 * download needs. Wrapping a CSV in `{ success: true, data: "…" }` would make the browser save a
 * JSON file containing escaped CSV, which is the single most common way an export goes wrong.
 *
 * **The CSV is built from the same `getReport()` call as the JSON**, with the same filters, so an
 * export can never disagree with the screen it was downloaded from. It is capped at the same
 * `limit` — a 20,000-row CSV is a 3 MB file nobody opens, and the on-screen row count already
 * tells the reader how many they are not getting.
 */
export const GET = handler(
  async (request, { params }) => {
    await requireStaff();

    const { type } = await parseParams(reportTypeSchema, params);
    const query = parseQuery(reportQuerySchema, request);
    const report = await getReport(type, query);

    if (query.format === "csv") {
      const csv = toCsv(report.columns, report.rows);

      return new Response(csv, {
        status: 200,
        headers: {
          // The charset is what makes the BOM meaningful on the way out.
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${csvFilename(type)}"`,
          // A report is point-in-time data; caching one is how somebody quotes last Tuesday's
          // fines as this week's.
          "Cache-Control": "no-store",
        },
      });
    }

    return ok(report);
  },
  { name: "GET /api/reports/:type" },
);