"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";
import { ROUTES } from "@/lib/constants";

/**
 * Notification bell.
 *
 * Static in Unit 05 — the count and dropdown are wired to real data in Unit 16.
 * The trigger still links to the notifications page so the affordance is honest
 * rather than a dead button.
 */
export function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}>
          <span className="relative grid place-items-center">
            <Bell className="size-[18px]" strokeWidth={1.75} />
            {count > 0 ? (
              <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-accent-foreground">
                {count > 9 ? "9+" : count}
              </span>
            ) : null}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-small font-semibold text-foreground">Notifications</p>
          <Link
            href={ROUTES.member.notifications}
            className="text-caption text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <EmptyState
          icon={Bell}
          title="You are all caught up"
          description="Loan updates, reservation holds and fines will appear here."
          className="py-10"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
