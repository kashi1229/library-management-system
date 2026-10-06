import { handler, ok, parseBody, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { suspendMember } from "@/lib/services/members";
import { memberIdSchema, suspendMemberSchema } from "@/lib/validators/members";

/**
 * POST /api/members/:id/suspend — staff.
 *
 * The reason is **required**, and it is both stored and sent to the member as a
 * notification. Without it the member would see "your account is suspended" and have
 * no way to know what to fix, which is the single most common complaint a library desk
 * receives about suspensions.
 */
export const POST = handler(async (request, { params }) => {
  const { user } = await requireStaff();
  const { id } = await parseParams(memberIdSchema, params);
  const { reason } = await parseBody(suspendMemberSchema, request);

  const member = await suspendMember(id, reason, { id: user.id, role: user.role });
  return ok({ member });
}, { name: "POST /api/members/:id/suspend" });