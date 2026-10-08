"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/common/book-cover";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { FineListItem, PublicPolicy } from "@/lib/api-client";

/**
 * One fine, as a row (spec 13).
 *
 * **A row, not a table.** A fine is one sentence — a book, how late, how much, what state —
 * and both screens that show it (the member's own list and the staff table) need the same
 * fields. A `<table>` here would mean the member view has four columns of whitespace and
 * no second line for the reason a waive carries.
 *
 * `ratePerDay` is shown as **"$5.00/day"** rather than "3 days × $5.00" because a member
 * reading a fine wants to know the rate that will apply next time, not the arithmetic that
 * produced this one.
 *
 * `showMember` is the only difference between the two callers: the member knows who they
 * are, and repeating their name on every row is noise.
 */
export function FineRow({
  fine,
  policy,
  showMember = true,
  className,
}: {
  fine: FineListItem;
  policy: PublicPolicy | undefined;
  showMember?: boolean;
  className?: string;
}) {
  const symbol = policy?.currencySymbol;
  const closed = fine.status !== "unpaid";

  return (
    <li
      className={cn(
        "rounded-lg border bg-surface p-4 shadow-soft",
        // An unpaid fine is the only state that still demands something, so it is the
        // only one that earns a coloured edge.
        closed ? "border-border" : "border-danger/30",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <BookCover
          publicId={fine.book.cover?.publicId}
          url={fine.book.cover?.url}
          title={fine.book.title}
          author={fine.book.authors[0] ?? null}
          width={40}
          sizes="40px"
          className="h-14 w-9 shrink-0 rounded-sm"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/catalog/${fine.book.slug}`}
              className="line-clamp-1 text-small font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
            >
              {fine.book.title}
            </Link>
            <StatusBadge status={fine.status} />
            {!closed && fine.daysOverdue > 0 ? (
              <Badge variant="danger" className="font-mono">
                {fine.daysOverdue}d late
              </Badge>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-caption text-muted-foreground">
            {fine.book.authors.join(", ") || "Unknown author"}
            {showMember ? ` · ${fine.member.name}` : ""}
          </p>

          <p className="mt-1 text-caption text-muted-foreground">
            {fine.daysOverdue} {fine.daysOverdue === 1 ? "day" : "days"} overdue at{" "}
            {formatCurrency(fine.ratePerDay, { fallbackSymbol: symbol })}/day &middot; raised{" "}
            {formatDate(fine.raisedAt)}
            {fine.paidAt ? ` · paid ${formatDate(fine.paidAt)}` : ""}
            {fine.paymentMethod && fine.paidAt ? ` by ${fine.paymentMethod}` : ""}
          </p>

          {/* A waive reason is the one thing that explains *why* a debt disappeared, so it
              gets its own line rather than being buried in a tooltip. */}
          {fine.reason ? (
            <p className="mt-1.5 text-caption text-pretty text-muted-foreground">
              <span className="font-medium text-foreground">Waived:</span> {fine.reason}
            </p>
          ) : null}

          {fine.note ? (
            <p className="mt-1 text-caption text-pretty text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> {fine.note}
            </p>
          ) : null}
        </div>

        <p
          className={cn(
            "shrink-0 font-display text-h3 font-semibold tabular-nums",
            closed ? "text-muted-foreground line-through decoration-border" : "text-danger-ink",
          )}
        >
          {formatCurrency(fine.amount, { fallbackSymbol: symbol })}
        </p>
      </div>
    </li>
  );
}