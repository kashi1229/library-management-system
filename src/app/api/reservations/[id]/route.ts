import { handler, ok, parseParams } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { cancelReservation } from "@/lib/services/reservations";
import { reservationParamSchema } from "@/lib/validators/reservation";

/**
 * DELETE /api/reservations/:id — leave a queue.
 *
 * `requireSession()` rather than a role guard, because **the owner and staff are both
 * allowed and the service is what tells them apart** — it compares the reservation's member
 * against the session id and returns 403 otherwise (invariant 3). A route-level
 * `requireStaff()` would break members cancelling their own hold, and trusting a
 * client-supplied "is this mine" would let anyone cancel anything.
 *
 * Cancelling a `ready` hold promotes the next member in the queue inside the same
 * transaction, so the copy is never left invisible to the catalog.
 */
export const DELETE = handler(async (_request, { params }) => {
  const { actor } = await requireSession();
  const { id } = await parseParams(reservationParamSchema, params);

  const reservation = await cancelReservation(id, actor);

  return ok({ reservation });
}, { name: "DELETE /api/reservations/:id" });