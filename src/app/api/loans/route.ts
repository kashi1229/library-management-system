import { handler, ok, parseQuery } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { listLoans } from "@/lib/services/circulation";
import { listLoansQuerySchema } from "@/lib/validators/loan";

/**
 * GET /api/loans — **staff only** (F7, spec 11).
 *
 * The desk's loan table: every loan, narrowed by the derived `status` view, by member,
 * by book, by issue-date range, or by free text across both.
 *
 * `status` is optional rather than defaulted, so no filter means *all* loans. Defaulting
 * it would make the desk open on a filter nobody chose, and "returned" — the most common
 * query at a returns pile — would be invisible.
 */
export const GET = handler(async (request) => {
  await requireStaff();

  const query = parseQuery(listLoansQuerySchema, request);
  const { items, meta } = await listLoans(query);

  return ok({ items }, meta);
}, { name: "GET /api/loans" });