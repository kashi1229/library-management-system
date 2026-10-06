import { handler, ok, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { activateMember } from "@/lib/services/members";
import { memberIdSchema } from "@/lib/validators/members";

/**
 * POST /api/members/:id/activate — staff.
 *
 * Idempotent: activating an already-active member simply returns them, so a
 * double-clicked button cannot write a second audit entry.
 */
export const POST = handler(async (_request, { params }) => {
  const { user } = await requireStaff();
  const { id } = await parseParams(memberIdSchema, params);

  const member = await activateMember(id, { id: user.id, role: user.role });
  return ok({ member });
}, { name: "POST /api/members/:id/activate" });