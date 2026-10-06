import { handler, ok, parseBody, parseParams } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { updateTeamMember } from "@/lib/services/team";
import { memberIdSchema, updateTeamMemberSchema } from "@/lib/validators/members";

/**
 * PATCH /api/team/:id — admin only. Name and/or status.
 *
 * "You cannot change the status of your own account" and "this is the only active
 * administrator" are enforced in `updateTeamMember`, so they apply to every caller.
 * Both are `RULE_VIOLATION` (400): the request was well-formed, the action is just
 * not permitted.
 */
export const PATCH = handler(async (request, { params }) => {
  const { user } = await requireAdmin();
  const { id } = await parseParams(memberIdSchema, params);
  const input = await parseBody(updateTeamMemberSchema, request);

  const member = await updateTeamMember(id, input, { id: user.id, role: user.role });
  return ok({ member });
}, { name: "PATCH /api/team/:id" });