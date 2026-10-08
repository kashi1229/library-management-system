"use client";

import Link from "next/link";
import { MoreHorizontal, PackageCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/utils";
import type { LoanBookRef, ReservationSummary } from "@/lib/api-client";

/** What the row menu can do. Owned by the register, so the menu stays dumb. */
export type ReservationRowActions = {
  onFulfil: (reservation: ReservationSummary) => void;
  onCancel: (reservation: ReservationSummary) => void;
};

/**
 * A book's title, linked **only when there is somewhere to link to**.
 *
 * `bookRefOr` returns `slug: ""` as the signal that the book is gone — a real, reachable
 * state, because a reservation outlives its book and the database can hold rows whose
 * `book` no longer exists. An empty slug in an href produces `/catalog/`, which lands the
 * librarian on the catalog listing having asked for a book that is not there. Rendering the
 * placeholder as plain text is the honest outcome; a link that goes somewhere else is not.
 */
export function BookTitle({
  book,
  className,
}: {
  book: LoanBookRef;
  className?: string;
}) {
  if (!book.slug) {
    return <span className={className}>{book.title}</span>;
  }

  return (
    <Link
      href={`/catalog/${book.slug}`}
      className={`underline-offset-2 hover:underline ${className ?? ""}`}
    >
      {book.title}
    </Link>
  );
}

/**
 * Per-row overflow menu on the staff register.
 *
 * **Only a `ready` hold can be fulfilled**, so the menu exists at all only for one. A
 * `waiting` reservation has no copy set aside — fulfilling it would be issuing a book nobody
 * has returned — and a closed one is terminal. Offering a control that is guaranteed to
 * fail is worse than showing none, so only the Ready tab renders a menu.
 *
 * Cancel is separated and tinted `danger` with a worded label, never colour alone
 * (`ui-context.md`). It is genuinely destructive here: cancelling a **ready** hold puts the
 * copy straight back on the shelf for whoever is next, which is why it opens a confirmation
 * naming the consequence rather than acting straight from a menu item.
 *
 * The trigger is always mounted and never disabled, so keyboard users keep a stable tab stop.
 */
export function ReservationRowActionMenu({
  reservation,
  actions,
  align = "end",
}: {
  reservation: ReservationSummary;
  actions: ReservationRowActions;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for the reservation on ${reservation.book.title}`}
          className="shrink-0 text-muted-foreground"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="min-w-48">
        <DropdownMenuItem onSelect={() => actions.onFulfil(reservation)}>
          <PackageCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Fulfil and issue
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => actions.onCancel(reservation)}
          className="text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
        >
          <XCircle className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Cancel reservation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The same row as a card, for under `lg` (spec 14: the table and the cards are rendered from
 * one array and the same helpers — the Unit 08 decision, so the two cannot drift).
 */
export function ReservationCard({
  reservation,
  actions,
}: {
  reservation: ReservationSummary;
  actions: ReservationRowActions;
}) {
  const ready = reservation.status === "ready";

  return (
    <li
      className={
        ready
          ? "rounded-lg border border-success/35 bg-surface p-4 shadow-soft"
          : "rounded-lg border border-border bg-surface p-4 shadow-soft"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <BookTitle
          book={reservation.book}
          className="line-clamp-2 min-w-0 font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
        />
        <ReservationStatusLine reservation={reservation} />
      </div>

      <p className="mt-0.5 truncate text-caption text-muted-foreground">
        {reservation.book.authors.join(", ") || "Unknown author"}
      </p>

      <p className="mt-1 text-small text-muted-foreground">
        {reservation.member.id && reservation.member.name !== "Unknown member" ? (
          <Link
            href={`/staff/members/${reservation.member.id}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {reservation.member.name}
          </Link>
        ) : (
          // Placeholder from `memberRefOr` — the account is gone. Not a link, because the
          // record it would open does not exist.
          <span>{reservation.member.name}</span>
        )}
        {reservation.member.membershipId ? (
          <span className="ms-1.5 font-mono text-caption">{reservation.member.membershipId}</span>
        ) : null}
      </p>

      <p className="mt-1 text-caption text-muted-foreground">{describeTimeline(reservation)}</p>

      {ready ? (
        <div className="mt-3">
          <ReservationRowActionMenu reservation={reservation} actions={actions} align="start" />
        </div>
      ) : null}
    </li>
  );
}

/**
 * The one-line "where is this hold and how urgent is it" sentence both layouts share.
 *
 * The countdown comes from `hoursUntilExpiry`, which the **server** derived and rounded up.
 * Recomputing it here from `expiresAt` would reintroduce the rounding rule as a second
 * implementation — and a hold with 40 minutes left must not read "0 hours left".
 */
export function ReservationStatusLine({ reservation }: { reservation: ReservationSummary }) {
  if (reservation.status === "ready") {
    const hours = reservation.hoursUntilExpiry ?? 0;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-caption font-medium whitespace-nowrap text-success-ink">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success-ink" />
        Ready &middot; {hours} {hours === 1 ? "hour" : "hours"} left
      </span>
    );
  }

  if (reservation.status === "waiting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-caption font-medium whitespace-nowrap text-warning-ink">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warning-ink" />
        {reservation.queuePosition ? `#${reservation.queuePosition} in line` : "Waiting"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-caption font-medium whitespace-nowrap text-muted-foreground">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {closedLabel(reservation)}
    </span>
  );
}

/** `Collected` / `Expired` / `Cancelled` — which of the three terminal states this was. */
export function closedLabel(reservation: ReservationSummary): string {
  if (reservation.status === "fulfilled") return "Collected";
  if (reservation.status === "expired") return "Expired";
  if (reservation.status === "cancelled") return "Cancelled";
  return "Waiting";
}

/**
 * `Requested 12 Mar 2026 · expires 14 Mar, 09:00` — the two dates the desk needs.
 *
 * Shared formatting via `formatDate`, which returns an em dash for a missing value so a
 * column never collapses.
 */
export function describeTimeline(reservation: ReservationSummary): string {
  const parts = [`Requested ${formatDate(reservation.requestedAt)}`];

  if (reservation.status === "ready") {
    parts.push(`expires ${formatDate(reservation.expiresAt, "d MMM, HH:mm")}`);
  } else if (reservation.status === "waiting") {
    parts.push("no copy held yet");
  } else if (reservation.status === "cancelled") {
    parts.push(`cancelled ${formatDate(reservation.cancelledAt)}`);
  } else if (reservation.status === "fulfilled") {
    parts.push("loan created");
  } else {
    parts.push("hold expired");
  }

  return parts.join(" · ");
}