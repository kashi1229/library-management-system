"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";
import { NOTIFICATION_PRESENTATION, notificationsApi } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { cn } from "@/lib/utils";
import type { NotificationSummary } from "@/types";

/**
 * Notification bell (spec 16).
 *
 * **Polls on a 60-second interval and shakes when the count goes up.** The shake is not
 * decoration: the bell is the only place the count appears, and without a *change* of state a
 * member has no way of knowing a notification arrived other than happening to look. Under
 * `prefers-reduced-motion` the animation is dropped and the badge itself is the signal — the
 * information must not depend on the motion being seen.
 *
 * **`refreshInterval` rather than a `setInterval`.** SWR already knows how to poll, dedupe and
 * stop polling on unmount; a hand-rolled interval keeps fetching after the tab is closed and
 * fetches while the tab is hidden.
 *
 * **Clicking a notification marks it read *and* navigates.** Both happen, because a member who
 * opens the notification and reads it has read it, and a badge that stays at 3 after reading
 * three things is a badge they stop believing. The mark is fire-and-forget — navigation must not
 * wait on a POST, or the link feels broken on a slow connection.
 */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();

  const { data, mutate } = useSWR(
    "/api/notifications?limit=6",
    async () => {
      // **No positional parameters.** SWR calls `fetcher(key)`, so a `(signal)` first
      // argument receives the *string cache key* and hands it to `fetch`. This has bitten this
      // codebase three times; see `api-client.ts`.
      const controller = new AbortController();
      const response = await notificationsApi.list({ limit: 6 }, controller.signal);
      return response.data;
    },
    { refreshInterval: 60_000, keepPreviousData: true },
  );

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const reduced = usePrefersReducedMotion();

  /* ------------------------------- The shake ------------------------------- */
  const previousCount = React.useRef(unreadCount);
  const [shaking, setShaking] = React.useState(false);

  React.useEffect(() => {
    if (unreadCount > previousCount.current) {
      setShaking(true);
      const timer = setTimeout(() => setShaking(false), 700);
      previousCount.current = unreadCount;
      return () => clearTimeout(timer);
    }
    previousCount.current = unreadCount;
  }, [unreadCount]);

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      await mutate();
    } catch {
      // The badge is not worth an error banner in the topbar: it refreshes in 60s anyway, and
      // a failed "mark all read" leaves the count correct rather than wrong.
      await mutate();
    }
  };

  const open = (notification: NotificationSummary) => {
    if (!notification.isRead) {
      void notificationsApi.markRead(notification.id).then(() => mutate());
    }

    if (notification.link) router.push(notification.link);
    else router.push(ROUTES.member.notifications);
  };

  const triggerLabel =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : items.length > 0
        ? "Notifications, none unread"
        : "Notifications";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={triggerLabel}
          className={cn("relative", shaking && !reduced && "animate-bell-shake")}
        >
          <span className="relative grid place-items-center">
            <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            {unreadCount > 0 ? (
              /*
               * `aria-hidden` because the count is already in the trigger's label. Announcing it
               * twice makes a screen reader say "Notifications, 3 unread" and then "3" as
               * separate items for one number.
               */
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-accent-foreground"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-small font-semibold text-foreground">Notifications</p>

          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-caption text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <CheckCheck className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                Mark all read
              </button>
            ) : null}

            <Link
              href={ROUTES.member.notifications}
              className="text-caption text-primary underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="You are all caught up"
            description="Loan updates, reservation holds and fines will appear here."
            className="py-10"
          />
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={() => open(notification)}
                current={pathname === notification.link}
              />
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One row in the popover. */
function NotificationRow({
  notification,
  onOpen,
  current,
}: {
  notification: NotificationSummary;
  onOpen: () => void;
  /** True when this notification's link is the page you are already on. */
  current: boolean;
}) {
  const { icon: Icon, className } = NOTIFICATION_PRESENTATION[notification.type];

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={current ? "page" : undefined}
        className={cn(
          "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          notification.isRead ? "opacity-70" : "bg-accent-soft/20",
        )}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", className)}>
          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-small font-medium text-foreground">{notification.title}</span>
            {!notification.isRead ? (
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full bg-accent"
              />
            ) : null}
          </span>

          <span className="mt-0.5 line-clamp-2 block text-caption text-muted-foreground">
            {notification.message}
          </span>

          <span className="mt-1 block text-caption text-muted-foreground/80">
            {formatRelative(notification.createdAt)}
          </span>
        </span>
      </button>
    </li>
  );
}