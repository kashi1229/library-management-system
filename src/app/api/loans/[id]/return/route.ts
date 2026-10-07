import { handler, ok, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { returnLoan } from "@/lib/services/circulation";
import { loanParamSchema } from "@/lib/validators/loan";

/**
 * POST /api/loans/:id/return — **staff only** (business rule 2).
 *
 * Returning is a desk action, so it is staff-only even though a member may renew their
 * own loan. There is no "I returned it" button: the copy has to come back to the shelf,
 * which means someone has to check it in.
 *
 * The response carries `fine` as well as `loan`, because this is the moment a late return
 * creates one and the desk needs to say so immediately rather than let the member
 * discover it on their next sign-in. `fine` is `null` until Unit 13 fills in the hook.
 */
export const POST = handler(async (_request, { params }) => {
  const { user } = await requireStaff();
  const { id } = await parseParams(loanParamSchema, params);

  const result = await returnLoan(id, { id: user.id, role: user.role });
  return ok(result);
}, { name: "POST /api/loans/:id/return" });