import { handler, ok, parseBody, parseQuery } from "@/lib/api";
import { requireActiveMember, requireStaff } from "@/lib/auth/session";
import { listReservations, reserveBook } from "@/lib/services/reservations";
import { listReservationsQuerySchema, reserveBookSchema } from "@/lib/validators/reservation";

/**
 * GET /api/reservations — **staff only** (F8).
 *
 * The register: the Ready / Waiting / History tabs, and one book's queue when `bookId` is
 * sent (which is what the "View queue" sheet in the books table asks for).
 *
 * `status` is optional, so no filter means *every* reservation rather than silently hiding
 * the closed ones — the History tab is exactly that request with three statuses named.
 */
export const GET = handler(async (request) => {
  await requireStaff();

  const query = parseQuery(listReservationsQuerySchema, request);
  const { items, meta } = await listReservations(query);

  return ok({ items }, meta);
}, { name: "GET /api/reservations" });

/**
 * POST /api/reservations — a member joins a queue (F8, business rule 5).
 *
 * `requireActiveMember()` rather than `requireSession()`: a suspended member may still sign
 * in and read, but reserving is one of the three things they are blocked from. The service
 * re-checks the status independently of this route, so no other caller can skip it.
 *
 * Only `bookId` is accepted. The member comes from the session (invariant 3), so a client
 * cannot queue somebody else by editing the body.
 */
export const POST = handler(async (request) => {
  const { actor } = await requireActiveMember();

  const { bookId } = await parseBody(reserveBookSchema, request);
  const reservation = await reserveBook(bookId, actor);

  return ok({ reservation }, undefined, 201);
}, { name: "POST /api/reservations" });