import { handler, ok, parseQuery } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { listMyLoans } from "@/lib/services/circulation";
import { listMyLoansQuerySchema } from "@/lib/validators/loan";

/**
 * GET /api/loans/mine — any signed-in user, their own loans.
 *
 * **The member id comes from the session, not the query** (invariant 3). The schema has
 * no `memberId` at all, so editing the URL cannot reach someone else's loans — the one
 * thing this route must never allow.
 *
 * Staff reach their own loans here too; the desk uses `/api/loans` for everyone else's.
 */
export const GET = handler(async (request) => {
  const { user } = await requireSession();

  const query = parseQuery(listMyLoansQuerySchema, request);
  const { items, meta } = await listMyLoans(user.id, query);

  return ok({ items }, meta);
}, { name: "GET /api/loans/mine" });