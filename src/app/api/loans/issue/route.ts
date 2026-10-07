import { handler, ok, parseBody } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { issueLoan } from "@/lib/services/circulation";
import { issueLoanSchema } from "@/lib/validators/loan";

/**
 * POST /api/loans/issue — **staff only** (business rule 1).
 *
 * Thinnest possible handler: authenticate, validate, call the service, respond. Every
 * policy check and the whole transaction live in `lib/services/circulation.ts`
 * (invariant 1).
 *
 * `memberId` in the body is the documented exception to "ownership is derived from the
 * session" (invariant 3): a librarian is naming the member standing at the counter.
 * The service still role-checks that the target is a `member`, and a member calling this
 * route never reaches the service because `requireStaff()` runs first.
 *
 * `201` because a loan is a new resource.
 */
export const POST = handler(async (request) => {
  const { user } = await requireStaff();

  const input = await parseBody(issueLoanSchema, request);
  const loan = await issueLoan(input, { id: user.id, role: user.role });

  return ok({ loan }, undefined, 201);
}, { name: "POST /api/loans/issue" });