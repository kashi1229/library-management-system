import { handler, ok, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { resetPassword } from "@/lib/services/members";
import { memberIdSchema } from "@/lib/validators/members";

/**
 * POST /api/members/:id/reset-password — staff for members, **admin for staff**.
 *
 * The role split is enforced inside `resetPassword`, not here, so every caller
 * inherits it. This route only establishes that the caller is staff at all.
 *
 * The response carries the generated password **once**. It is never stored, so this is
 * the only moment it exists in plaintext — the UI is built around that (copy it, then
 * it is gone).
 */
export const POST = handler(async (_request, { params }) => {
  const { user } = await requireStaff();
  const { id } = await parseParams(memberIdSchema, params);

  const result = await resetPassword(id, { id: user.id, role: user.role });
  return ok(result);
}, { name: "POST /api/members/:id/reset-password" });