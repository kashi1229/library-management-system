import { handler, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { listMyReservations } from "@/lib/services/reservations";

/**
 * GET /api/reservations/mine — any signed-in user, their own holds.
 *
 * **No member id and no filters** (invariant 3): the schema has neither, so editing the URL
 * cannot reach somebody else's queue. The response is already grouped into
 * `ready` / `waiting` / `past` with a `pastTotal`, so there is nothing for a query string to
 * select — and grouping here rather than in the browser is what keeps a member with more
 * than one page of history from silently losing rows.
 *
 * `requireSession()` and not `requireActiveMember()`: a suspended member keeps their place
 * in a queue. Being suspended stops them borrowing, not reading.
 */
export const GET = handler(async () => {
  const { user } = await requireSession();

  const reservations = await listMyReservations(user.id);

  return ok(reservations);
}, { name: "GET /api/reservations/mine" });