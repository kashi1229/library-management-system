import { handler, ok, parseQuery } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { listMyFines } from "@/lib/services/fines";
import { listMyFinesQuerySchema } from "@/lib/validators/fine";

/**
 * GET /api/fines/mine — any signed-in user, their own fines.
 *
 * **No member id is accepted** (invariant 3): the schema has no such field, so editing the
 * URL cannot reach somebody else's fines.
 *
 * `outstandingTotal` is returned alongside the list, and it is the *unpaid* total rather
 * than the sum of the visible page — the list is paginated, so adding up what is on screen
 * would under-report a member's debt the moment they had more than `limit` fines.
 */
export const GET = handler(async (request) => {
  const { user } = await requireSession();

  const query = parseQuery(listMyFinesQuerySchema, request);
  const { items, meta, outstandingTotal } = await listMyFines(user.id, query);

  return ok({ items, outstandingTotal }, meta);
}, { name: "GET /api/fines/mine" });