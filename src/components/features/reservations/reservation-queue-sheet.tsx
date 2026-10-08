"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/common/status-badge";
import { reservationsApi } from "@/lib/api-client";
import { formatDate, initials } from "@/lib/utils";

/**
 * One book's live queue, in a sheet (spec 14 — the "View queue" item on the staff books
 * table row menu).
 *
 * **Opened from a row menu on a page that already has the book**, so the book is passed in
 * rather than fetched: the sheet is about the queue, not about re-reading a title the
 * librarian is already looking at. It asks for exactly the live queue
 * (`status=waiting,ready`) instead of every reservation this book has ever had, because the
 * question behind the menu is "who is waiting for this?", and a book with a year of cancelled
 * and expired holds would bury the answer under its own history.
 *
 * **Ready holds appear first, without a number.** They are not waiting for anything — a copy
 * is already set aside — so labelling them #1 next to somebody who has not been reached yet
 * reads as a queue error. The order is the order `promoteReservationQueue` promotes in.
 *
 * `meta.total` drives the heading count, so a long queue says so rather than looking shorter
 * than it is.
 */
export function ReservationQueueSheet({
  book,
  open,
  onOpenChange,
}: {
  book: { id: string; title: string; slug: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, error, isLoading } = useSWR(
    open && book ? `/api/reservations?bookId=${book.id}&status=waiting,ready&limit=100` : null,
    async () => reservationsApi.list({ bookId: book!.id, status: ["waiting", "ready"], limit: 100 }),
  );

  const rows = data?.data.items ?? [];
  const total = data?.meta?.total ?? rows.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-h3 tracking-[-0.02em] text-foreground">
            Queue
          </SheetTitle>
          <SheetDescription className="text-small text-muted-foreground">
            {book ? (
              <Link
                href={`/catalog/${book.slug}`}
                className="line-clamp-2 font-medium text-foreground underline-offset-2 hover:underline"
              >
                {book.title}
              </Link>
            ) : (
              "Nothing selected."
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {!book ? null : error && !data ? (
            <p className="text-small text-danger-ink">
              {error instanceof Error ? error.message : "Something went wrong."}
            </p>
          ) : isLoading && rows.length === 0 ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading the queue">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-border px-5 py-10 text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-accent-soft text-accent-ink">
                <Users className="size-5" strokeWidth={1.75} />
              </span>
              <p className="mt-3 font-display text-h3 font-semibold text-foreground">
                Nobody is queuing
              </p>
              <p className="mt-1 text-small text-pretty text-muted-foreground">
                No member is waiting for this book, and no copy is being held for anyone.
              </p>
            </div>
          ) : (
            <>
              <p aria-live="polite" className="mb-3 text-small text-muted-foreground">
                {total} {total === 1 ? "person is" : "people are"} in this queue
              </p>

              <ol className="space-y-3">
                {rows.map((entry) => {
                  const ready = entry.status === "ready";

                  return (
                    <li
                      key={entry.id}
                      className={
                        ready
                          ? "rounded-lg border border-success/35 bg-success-soft/40 p-3"
                          : "rounded-lg border border-border p-3"
                      }
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-caption">
                            {initials(entry.member.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/staff/members/${entry.member.id}`}
                              className="truncate text-small font-medium text-foreground underline-offset-2 hover:underline"
                            >
                              {entry.member.name}
                            </Link>
                            {entry.member.membershipId ? (
                              <span className="font-mono text-caption text-muted-foreground">
                                {entry.member.membershipId}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={entry.status} />
                            {!ready && entry.queuePosition ? (
                              <span className="text-caption font-medium text-warning-ink">
                                #{entry.queuePosition} in line
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-caption text-muted-foreground">
                            <Clock className="me-1 inline size-3" strokeWidth={1.75} aria-hidden="true" />
                            Joined {formatDate(entry.requestedAt)}
                            {ready && entry.expiresAt
                              ? ` · hold ends ${formatDate(entry.expiresAt, "d MMM, HH:mm")}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <div className="border-t border-border p-4">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}