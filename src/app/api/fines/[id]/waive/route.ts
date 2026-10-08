import { handler, ok, parseBody, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { waiveFine } from "@/lib/services/fines";
import { fineParamSchema, waiveFineSchema } from "@/lib/validators/fine";

/**
 * POST /api/fines/:id/waive — **staff only** (F9).
 *
 * `unpaid → waived`, terminal, and **a reason is required**. Waiving someone's debt is the
 * one fine action with no trace of who decided it or why, so the reason is validated at the
 * transport layer *and* stored on the document, not just written to the audit log.
 */
export const POST = handler(async (request, { params }) => {
  const { user } = await requireStaff();
  const { id } = await parseParams(fineParamSchema, params);
  const input = await parseBody(waiveFineSchema, request);

  const fine = await waiveFine(id, input, { id: user.id, role: user.role });
  return ok({ fine });
}, { name: "POST /api/fines/:id/waive" });