import { handler, ok, parseQuery } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { listFines } from "@/lib/services/fines";
import { listFinesQuerySchema } from "@/lib/validators/fine";

/**
 * GET /api/fines — **staff only** (F9).
 *
 * The staff fine table, with the three KPI totals the desk shows. `totals` is computed over
 * the **whole** filter rather than the visible page: "Unpaid total" is the money the library
 * is owed, and slicing it to 20 rows would under-report it. `page` and `limit` are
 * deliberately excluded from the totals query.
 *
 * `status` is optional, so no filter means *all* fines — defaulting would hide the paid
 * ones, which is the half of the history an admin reconciles against.
 */
export const GET = handler(async (request) => {
  await requireStaff();

  const query = parseQuery(listFinesQuerySchema, request);
  const { items, meta, totals } = await listFines(query);

  return ok({ items, totals }, meta);
}, { name: "GET /api/fines" });