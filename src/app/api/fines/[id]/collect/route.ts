import { handler, ok, parseBody, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { collectFine } from "@/lib/services/fines";
import { collectFineSchema, fineParamSchema } from "@/lib/validators/fine";

/**
 * POST /api/fines/:id/collect — **staff only** (F9).
 *
 * `unpaid → paid` and nothing else. The terminal-state check lives in the service so every
 * caller inherits it, and a second attempt is a 400 with a sentence rather than a silent
 * no-op.
 *
 * `amount` is required, so an admin recording a payment must say how much was actually
 * taken; the service refuses a part payment because `Fine` has no `amountPaid` field and
 * accepting one would mark a large debt settled and quietly lose the difference.
 */
export const POST = handler(async (request, { params }) => {
  const { user } = await requireStaff();
  const { id } = await parseParams(fineParamSchema, params);
  const input = await parseBody(collectFineSchema, request);

  const fine = await collectFine(id, input, { id: user.id, role: user.role });
  return ok({ fine });
}, { name: "POST /api/fines/:id/collect" });