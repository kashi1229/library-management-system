"use client";

import * as React from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import type { StaffActivityItem } from "@/types";
import { auditPresentation } from "@/lib/audit-templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Recent activity, newest first, from the audit log.
 *
 * **The `summary` recorded at the time of the action, never re-derived.** The audit log is
 * append-only and never pruned (invariant 10), so it outlives the documents it describes: a
 * deleted book's actions are still here. Re-joining to a live `Book` would blank the row for
 * exactly the events an administrator most wants to read.
 *
 * **Relative time, with the absolute one available.** "3 minutes ago" is the useful form while
 * working; "10 Oct 2026, 14:02" is the useful form when somebody is reconstructing an incident.
 * `formatRelative` gives the first and a `title` gives the second — and because `title` is
 * unreachable by touch, the exact timestamp is also in the row's `sr-only` text.
 */
export function ActivityFeed({ items }: { items: StaffActivityItem[] }) {
  const hasItems = items.length > 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2 space-y-0">
        <CardTitle className="font-display text-h3 font-semibold tracking-[-0.02em]">
          Recent activity
        </CardTitle>
        {hasItems ? (
          <Button asChild variant="ghost" size="sm" className="-mt-1 -me-1">
            <Link href={ROUTES.staff.audit}>View all</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex-1">
        {hasItems ? (
          <ol className="space-y-4">
            {items.map((item) => {
              const { icon: Icon, className } = auditPresentation(item.action);
              const when = new Date(item.createdAt);
              const absolute = Number.isNaN(when.getTime())
                ? ""
                : when.toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

              return (
                <li key={item.id} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={cn("grid size-8 shrink-0 place-items-center rounded-full", className)}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-small text-foreground text-pretty">{item.summary}</p>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {/* The action name is `sr-only` rather than visible: it is the sort key a
                          librarian might want, not something a glance needs. */}
                      <span className="sr-only">{item.action}, </span>
                      <time dateTime={item.createdAt} title={absolute || undefined}>
                        {formatRelative(item.createdAt)}
                      </time>
                      {absolute ? <span className="sr-only"> — {absolute}</span> : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-6 py-10 text-center">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground"
            >
              <ScrollText className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-small font-medium text-foreground">Nothing logged yet</p>
            <p className="max-w-xs text-caption text-muted-foreground text-pretty">
              Issuing, returning and editing books all leave a trail here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}