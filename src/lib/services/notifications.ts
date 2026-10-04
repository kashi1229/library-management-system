import "server-only";
import type { ClientSession } from "mongoose";
import type { NotificationType } from "@/lib/constants";

/**
 * In-app notification creation.
 *
 * ⚠️ **Documented stub — implemented in Unit 16.**
 *
 * Every circulation service already calls `notify(...)` so the call sites are
 * final and stable. Until Unit 16 lands, this is a no-op that logs the intended
 * notification, which keeps issue / return / renew flows fully functional with
 * no notification rows.
 */

export type NotifyInput = {
  /** Recipient user id. */
  userId: unknown;
  type: NotificationType;
  title: string;
  message: string;
  /** In-app route the notification links to, e.g. `/my-loans`. */
  link?: string;
  /**
   * `type:id:YYYY-MM-DD` — the unique key that makes recurring notifications
   * (due-soon, overdue) idempotent across repeated maintenance runs.
   */
  dedupeKey?: string;
  /** Write inside an open transaction. */
  session?: ClientSession;
};

/** No-op until Unit 16. */
export async function notify(_input: NotifyInput): Promise<void> {
  // Intentionally empty: see the stub notice above.
}

/**
 * Build the idempotency key for a date-scoped notification.
 * Exported now so Unit 16 uses exactly one format.
 */
export function buildDedupeKey(type: NotificationType, id: unknown, on: Date): string {
  return `${type}:${String(id)}:${on.toISOString().slice(0, 10)}`;
}
