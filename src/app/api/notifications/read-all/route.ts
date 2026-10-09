import { handler, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { markAllRead } from "@/lib/services/notifications";

/**
 * POST /api/notifications/read-all — clear the whole badge in one press.
 *
 * **`updateMany` with `readAt: null`, not a loop.** The inbox is the one collection in this app
 * that a member can legitimately accumulate unboundedly, and a member with four hundred unread
 * notices must not wait for four hundred round trips to clear the badge.
 *
 * The route takes **no body and no id**: everything is scoped by the session member, so there
 * is nothing here that could mark somebody else's notifications read. The `modifiedCount` is
 * returned because "Mark all read" on an already-clear inbox reporting 1,400 changed would be
 * a lie the UI would have to work around.
 */
export const POST = handler(async () => {
  const { actor } = await requireSession();

  const marked = await markAllRead(actor.id);

  return ok({ marked });
}, { name: "POST /api/notifications/read-all" });