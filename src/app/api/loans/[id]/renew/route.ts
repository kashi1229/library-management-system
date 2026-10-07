import { handler, ok, parseParams } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { renewLoan } from "@/lib/services/circulation";
import { loanParamSchema } from "@/lib/validators/loan";

/**
 * POST /api/loans/:id/renew — **any signed-in user, their own loan** (business rule 3).
 *
 * This is the one circulation route that is *not* staff-only, because renewing your own
 * book is a member capability (F1/F7). `requireSession` rather than `requireStaff`, and
 * the service refuses a member who names somebody else's loan with a 403 — the
 * ownership check is in the service so no caller can skip it (invariant 3).
 *
 * `requireActiveMember` is deliberately **not** used: a suspended member must be able to
 * sign in and see their loans, and `architecture.md` §Auth & Access Model says wishlist and
 * profile edits remain allowed for them. The service checks `status` itself and returns a
 * clear reason for a suspended member, which is better than a redirect that explains
 * nothing.
 */
export const POST = handler(async (_request, { params }) => {
  const { user } = await requireSession();
  const { id } = await parseParams(loanParamSchema, params);

  const loan = await renewLoan(id, { id: user.id, role: user.role });
  return ok({ loan });
}, { name: "POST /api/loans/:id/renew" });