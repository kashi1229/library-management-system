import { handler, ok, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { getMemberDetail } from "@/lib/services/members";
import { memberIdSchema } from "@/lib/validators/members";

/**
 * GET /api/members/:id — staff.
 *
 * Counts **and** rows. The detail tabs read their loans, fines and reservations from
 * this response, so a client that only wanted the counts is now making a heavier call
 * than it needs — accepted deliberately, because the page is the only consumer and
 * splitting it into two round trips to save a capped query would be the wrong trade.
 */
export const GET = handler(async (_request, { params }) => {
  await requireStaff();
  const { id } = await parseParams(memberIdSchema, params);

  const member = await getMemberDetail(id);
  return ok({ member });
}, { name: "GET /api/members/:id" });