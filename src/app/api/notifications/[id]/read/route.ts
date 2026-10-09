import { handler, ok, parseParams } from "@/lib/api";
import { requireSession } from "@/lib/auth/session";
import { markRead } from "@/lib/services/notifications";
import { notificationIdSchema } from "@/lib/validators/notification";

/**
 * POST /api/notifications/:id/read — clear one.
 *
 * **The ownership check lives in the service** (`{ _id, user }`), because the id alone is not
 * authorisation: a member who guesses another member's notification id must get a 404 rather
 * than being able to mark it read. Distinguishing "does not exist" from "not yours" would also
 * tell a prober which ids are real, so both are the same answer.
 *
 * **Idempotent**, and the `readAt: null` guard means a second click does not move the timestamp
 * the member can see.
 */
export const POST = handler(async (_request, { params }) => {
  const { actor } = await requireSession();
  const { id } = await parseParams(notificationIdSchema, params);

  await markRead(id, actor.id);

  return ok({ id });
}, { name: "POST /api/notifications/:id/read" });