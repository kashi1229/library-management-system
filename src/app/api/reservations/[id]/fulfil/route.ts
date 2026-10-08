import { handler, ok, parseParams } from "@/lib/api";
import { requireStaff } from "@/lib/auth/session";
import { fulfilReservation } from "@/lib/services/reservations";
import { reservationParamSchema } from "@/lib/validators/reservation";

/**
 * POST /api/reservations/:id/fulfil — **staff only** (F8).
 *
 * Issues the book straight out of a `ready` hold, in **one transaction** with the hold
 * closing. The loan is created by `issueLoanInSession`, so every rule from business rule 1
 * still applies: a suspended member, an exhausted loan limit or a copy already promised
 * elsewhere all refuse here exactly as they would at the desk.
 *
 * The response carries both halves because the desk needs to say what happened in one
 * sentence — "issued, due 14 Oct" — rather than making the librarian click through to the
 * loan to find the due date they already have on screen.
 */
export const POST = handler(async (_request, { params }) => {
  const { actor } = await requireStaff();
  const { id } = await parseParams(reservationParamSchema, params);

  const { reservation, loan } = await fulfilReservation(id, actor);

  return ok({ reservation, loan });
}, { name: "POST /api/reservations/:id/fulfil" });