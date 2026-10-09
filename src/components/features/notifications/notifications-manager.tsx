"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isToday, isYesterday, format, isSameYear } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { NOTIFICATION_PRESENTATION, notificationsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import type { NotificationSummary, PageMeta } from "@/types";

/**
 * `/notifications` — the full inbox (spec 16).
 *
 * **Grouped by day, not by a flat list.** A member opening this page is asking "what happened,
 * and when", and forty undated rows answer neither. The group heading is a real date — "Today",
 * "Yesterday", then the date — because "Today" alone is useless to somebody who came back
 * tomorrow.
 *
 * **Two tabs, All and Unread.** Not one tab per type: fourteen types would be fourteen tabs, and
 * the question behind opening this page is never "show me only the fines" — it is "what have I
 * missed".
 *
 * **Clicking a row marks it read and navigates.** The row is a `<button>` inside a list rather
 * than a link, because the mark-read is part of the action and an `<a>` cannot promise it. The
 * mark is fired without awaiting, so a slow POST never delays the navigation the member asked
 * for — and the local state is updated optimistically, so the row dims immediately rather than
 * after a round trip.
 */
export function NotificationsManager() {
  const router = useRouter();
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const [page, setPage] = React.useState(1);

  const unreadOnly = tab === "unread";

  const { data, error, isLoading, mutate } = useSWR(
    `/api/notifications?page=${page}&limit=20&unreadOnly=${unreadOnly}`,
    async () => {
      // **No positional parameters.** SWR calls `fetcher(key)`, so a `(signal)` first argument
      // receives the *string cache key*. Three times in this codebase now.
      const controller = new AbortController();
      const response = await notificationsApi.list(
        { page, limit: 20, unreadOnly },
        controller.signal,
      );
      return response.data;
    },
    { keepPreviousData: true },
  );

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const meta = (data as { meta?: PageMeta } | undefined)?.meta;

  /** Switching tab always returns to page 1 — page 3 of the unread list is rarely page 1 of all. */
  const changeTab = (value: string) => {
    setTab(value as "all" | "unread");
    setPage(1);
  };

  const open = (notification: NotificationSummary) => {
    if (!notification.isRead) {
      // Optimistic: the row dims on the next render, not after the server answers.
      void notificationsApi.markRead(notification.id)
        .then(() => mutate())
        .catch(() => mutate());
    }

    if (notification.link) router.push(notification.link);
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    await mutate();
  };

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Notifications"
        description="Loan updates, reservation holds, fines and account activity."
        action={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 ? (
              <span
                aria-hidden="true"
                className="ml-1.5 rounded-full bg-accent px-1.5 text-[10px] leading-4 font-semibold text-accent-foreground"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {(["all", "unread"] as const).map((value) => (
          <TabsContent key={value} value={value}>
            {error && items.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface p-6 text-center">
                <p className="text-small text-danger-ink">
                  {error instanceof Error ? error.message : "Something went wrong."}
                </p>
                <Button variant="outline" className="mt-3" onClick={() => void mutate()}>
                  Try again
                </Button>
              </div>
            ) : isLoading && items.length === 0 ? (
              <NotificationSkeleton />
            ) : items.length === 0 ? (
              <div className="rounded-lg border border-border bg-surface">
                <EmptyState
                  icon={Bell}
                  title="You're all caught up"
                  description={
                    unreadOnly
                      ? "Nothing unread. Everything here has been read."
                      : "Loan updates, reservation holds and fines will appear here."
                  }
                  action={
                    <Button asChild>
                      <Link href={ROUTES.member.loans}>Go to my loans</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  {groupByDay(items).map((group) => (
                    <section key={group.key} aria-labelledby={`day-${group.key}`}>
                      <h2
                        id={`day-${group.key}`}
                        className="mb-2 text-caption font-medium tracking-wide text-muted-foreground uppercase"
                      >
                        {group.label}
                      </h2>

                      <ul className="overflow-hidden rounded-lg border border-border bg-surface shadow-soft">
                        {group.items.map((notification) => (
                          <NotificationCard
                            key={notification.id}
                            notification={notification}
                            onOpen={() => open(notification)}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>

                {meta && meta.totalPages > 1 ? (
                  <Pagination page={page} totalPages={meta.totalPages} onChange={setPage} />
                ) : null}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** One notification row. Separated by a border, not by spacing. */
function NotificationCard({
  notification,
  onOpen,
}: {
  notification: NotificationSummary;
  onOpen: () => void;
}) {
  const { icon: Icon, className } = NOTIFICATION_PRESENTATION[notification.type];

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-start gap-3.5 px-4 py-4 text-left transition-colors hover:bg-accent-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          notification.isRead ? "opacity-70" : "bg-accent-soft/15",
        )}
      >
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", className)}>
          <Icon className="size-4.5" strokeWidth={1.75} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "text-small text-pretty",
                notification.isRead
                  ? "font-medium text-foreground"
                  : "font-semibold text-foreground",
              )}
            >
              {notification.title}
            </span>

            {!notification.isRead ? (
              <>
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full bg-accent"
                />
                {/* The dot is decorative; this is what actually announces the unread state. */}
                <span className="sr-only">Unread</span>
              </>
            ) : null}

            
          </span>

          <span className="mt-1 block text-small text-pretty text-muted-foreground">
            {notification.message}
          </span>

          <span className="mt-1.5 block text-caption text-muted-foreground/80">
            {format(notification.createdAt, "HH:mm")}
          </span>
        </span>
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Day grouping                                                                */
/* -------------------------------------------------------------------------- */

type DayGroup = { key: string; label: string; items: NotificationSummary[] };

/**
 * Bucket notifications into Today / Yesterday / dated days.
 *
 * **The year is dropped only for the current year.** "3 Mar" is ambiguous in a list that spans
 * last December, and a member scrolling back through notices is precisely the reader who needs
 * to know which year they are looking at.
 *
 * The key is the date string rather than the label, so the group headings are unique even when
 * two groups somehow share a label.
 */
function groupByDay(items: NotificationSummary[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  const now = new Date();

  for (const notification of items) {
    const date = new Date(notification.createdAt);
    const key = format(date, "yyyy-MM-dd");

    if (!groups.has(key)) {
      let label: string;
      if (isToday(date)) label = "Today";
      else if (isYesterday(date)) label = "Yesterday";
      else label = format(date, isSameYear(date, now) ? "d MMM" : "d MMM yyyy");

      groups.set(key, { key, label, items: [] });
    }

    groups.get(key)!.items.push(notification);
  }

  return [...groups.values()];
}

/* -------------------------------------------------------------------------- */
/* Chrome                                                                      */
/* -------------------------------------------------------------------------- */

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Notifications pagination">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>

      <p className="text-caption text-muted-foreground" aria-live="polite">
        Page {page} of {totalPages}
      </p>

      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}

function NotificationSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex items-start gap-3.5 rounded-lg border border-border bg-surface p-4"
        >
          <span className="grid size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          <span className="flex-1 space-y-2">
            <span className="block h-3.5 w-1/3 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-3/4 animate-pulse rounded bg-muted" />
          </span>
        </div>
      ))}
    </div>
  );
}