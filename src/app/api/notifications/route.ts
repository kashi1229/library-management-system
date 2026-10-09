import { handler, ok, parseQuery } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { listNotifications } from "@/lib/services/notifications";
import { listNotificationsQuerySchema } from "@/lib/validators/notification";

/**
 * GET /api/notifications — the member's own inbox.
 *
 * **`requireSession()`, not `requireActiveMember()`**: a suspended member may still sign in and
 * read, and the notifications they are owed — including the notice that they were suspended —
 * are part of that. Marking read is the same: a member who cannot borrow must still be able to
 * clear a badge.
 *
 * **There is no member id in the query and there is no way to add one.** The member comes from
 * the session (invariant 3), so editing the URL cannot read somebody else's notifications, and
 * the validator has no field that could carry one.
 *
 * **`meta` and `unreadCount` are both real totals over the whole inbox**, not the page. The
 * badge on the bell is the count a member believes, so it cannot be derived from the twelve rows
 * on screen.
 */
export const GET = handler(async (request) => {
  const { actor } = await requireSession();

  const query = parseQuery(listNotificationsQuerySchema, request);
  const result = await listNotifications({
    userId: actor.id,
    page: query.page ?? 1,
    limit: query.limit ?? 12,
    unreadOnly: query.unreadOnly ?? false,
  });

  return ok({ items: result.items, unreadCount: result.unreadCount }, result.meta);
}, { name: "GET /api/notifications" });