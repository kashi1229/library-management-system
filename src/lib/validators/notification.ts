import { z } from "zod";
import { PAGINATION } from "@/lib/constants";

/**
 * Notifications (spec 16).
 *
 * Shape only — no policy numbers, because there are none: a notification is a courtesy about an
 * event, and everything worth capping is already capped by the model (`title` 120, `message`
 * 500) or by `dedupeKey`.
 */

/** `readAt`/`unreadOnly` are the whole filter surface. No member id, by construction. */
export const listNotificationsQuerySchema = z.object({
  /** Only unread. The page's Unread tab and nothing else. */
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(PAGINATION.maxLimit).optional(),
});

export const notificationIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Not a valid notification id"),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;