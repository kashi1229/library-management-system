import { handler, ok, parseQuery } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { lookupMembers } from "@/lib/services/members";
import { lookupQuerySchema } from "@/lib/validators/members";

/**
 * GET /api/members/lookup?q= — staff.
 *
 * The circulation desk's type-ahead (Unit 12). Capped at 8 in the service, because a
 * member has to be identifiable from eight rows — a longer list turns "find the right
 * person" into a second search.
 *
 * Its own segment rather than `GET /api/members?q=`: this returns a trimmed
 * projection for a dropdown, which is a different contract from the paginated list,
 * and mixing them behind a flag is how a list endpoint ends up returning the wrong
 * shape.
 */
export const GET = handler(async (request) => {
  await requireStaff();

  const { q } = parseQuery(lookupQuerySchema, request);
  const items = await lookupMembers(q, 8);

  return ok({ items });
}, { name: "GET /api/members/lookup" });