import { handler, ok, parseQuery } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { listMembers } from "@/lib/services/members";
import { listMembersQuerySchema } from "@/lib/validators/members";

/**
 * GET /api/members — staff.
 *
 * Members only (`role: "member"`), enforced in the service, so a librarian never
 * appears in a list whose row actions ("suspend") mean something different for them.
 * Staff accounts are managed on `/staff/team`.
 */
export const GET = handler(async (request) => {
  await requireStaff();

  const query = parseQuery(listMembersQuerySchema, request);
  const { items, meta } = await listMembers(query);

  return ok({ items }, meta);
}, { name: "GET /api/members" });