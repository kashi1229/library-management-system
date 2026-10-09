/**
 * Presentation metadata for a notification type.
 *
 * **Client-safe by design**: no `server-only`, no mongoose, no service imports. The bell popover,
 * the notifications page and the popover row all need to know which icon and colour a type
 * carries, and three `switch` statements in three components is three places for the palette to
 * disagree — the same reasoning that put `CATEGORY_COLOR_CLASS` in one place in Unit 07.
 *
 * `NOTIFICATION_TONE` lives in `lib/services/notifications.ts` beside the write, because the
 * service needs it to serialise; it is re-exported from `api-client` so a component has one
 * import for both. This file holds what only the UI needs.
 */

import {
  AlarmClock,
  BadgeCheck,
  Ban,
  BellRing,
  BookCheck,
  CircleDot,
  Clock,
  HandCoins,
  LibraryBig,
  PackageCheck,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Timer,
  TriangleAlert,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import type { NotificationType } from "@/lib/constants";

/**
 * One entry per type in `NOTIFICATION_TYPES`.
 *
 * Typed as a total `Record` rather than a partial map so **adding a type to
 * `NOTIFICATION_TYPES` without drawing it here is a compile error**, not a notification that
 * arrives with a blank tile. The same argument as `CATEGORY_ICON_NAMES` in Unit 07.
 */
export const NOTIFICATION_PRESENTATION: Record<
  NotificationType,
  { icon: LucideIcon; /** Tailwind `-soft` background + `-ink` foreground pair. */ className: string }
> = {
  loan_issued: { icon: BookCheck, className: "bg-info-soft text-info-ink" },
  loan_returned: { icon: LibraryBig, className: "bg-success-soft text-success-ink" },
  loan_renewed: { icon: Repeat, className: "bg-success-soft text-success-ink" },
  due_soon: { icon: Clock, className: "bg-warning-soft text-warning-ink" },
  overdue: { icon: Timer, className: "bg-danger-soft text-danger-ink" },
  fine_created: { icon: TriangleAlert, className: "bg-danger-soft text-danger-ink" },
  fine_paid: { icon: HandCoins, className: "bg-success-soft text-success-ink" },
  fine_waived: { icon: BadgeCheck, className: "bg-info-soft text-info-ink" },
  reservation_ready: { icon: PackageCheck, className: "bg-success-soft text-success-ink" },
  reservation_expired: { icon: AlarmClock, className: "bg-warning-soft text-warning-ink" },
  reservation_cancelled: { icon: Ban, className: "bg-info-soft text-info-ink" },
  account_suspended: { icon: ShieldAlert, className: "bg-danger-soft text-danger-ink" },
  account_activated: { icon: UserRoundCheck, className: "bg-success-soft text-success-ink" },
  new_reservation: { icon: CircleDot, className: "bg-info-soft text-info-ink" },
};

/** Used by the empty state, which has no single type to speak for. */
export const NOTIFICATIONS_EMPTY_ICON = BellRing;

/** Used by the "try again" affordance on the page's error state. */
export const NOTIFICATIONS_RETRY_ICON = RefreshCw;