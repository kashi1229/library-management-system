"use client";

import * as React from "react";
import { Clock, Hourglass, PackageCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/common/book-cover";
import { StatusBadge } from "@/components/common/status-badge";
import { BookTitle } from "@/components/features/reservations/reservation-row-actions";
import type { MemberReservation } from "@/lib/api-client";

/**
 * One hold, as a member sees it (spec 14).
 *
 * **The ready state gets its own treatment and nothing else does.** A copy set aside with
 * this member's name on it is the only thing on this page that needs them to do something,
 * so it is the only one that gets a success-tinted panel, a countdown and a sentence about
 * where to go. A queue position is information; a hold is an instruction.
 *
 * **The countdown is the server's number.** `hoursUntilExpiry` is computed by
 * `services/reservations.ts` and rounded *up*, so a hold with 40 minutes left says "1 hour"
 * rather than "0 hours" — a countdown reading zero while a copy is still on the shelf is the
 * number a member would screenshot and ask about. Recomputing it here from `expiresAt` would
 * reintroduce both the rounding rule and the disagreement with the record tab.
 *
 * **Cancellation is a real request, not a local hide.** Cancelling a `ready` hold releases
 * the copy and offers it to the next member in the queue, so pretending it worked while the
 * server still holds it would leave the book reading "all copies out" to everybody else.
 * The parent's `mutate` re-reads the truth afterwards.
 *
 * A disabled button carries its reason in `title` *and* as `sr-only` text — a `title` alone
 * is unreachable by touch and by keyboard.
 */
export function ReservationCard({
  reservation,
  pending,
  onCancel,
}: {
  reservation: MemberReservation;
  pending: boolean;
  onCancel: (reservation: MemberReservation) => void;
}) {
  const ready = reservation.status === "ready";
  const hours = reservation.hoursUntilExpiry ?? 0;

  const countdown = `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const expiryNote =
    hours <= 0
      ? "Your hold is closing — if it has not already moved on, ask at the desk."
      : hours <= 4
        ? `Collect it within ${countdown} — after that it goes to the next reader.`
        : `Held for you for ${countdown}.`;

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-lg border bg-surface shadow-soft",
        ready ? "border-success/40" : "border-border",
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
        <BookCover
          publicId={reservation.book.cover?.publicId}
          url={reservation.book.cover?.url}
          title={reservation.book.title}
          author={reservation.book.authors[0] ?? null}
          width={48}
          sizes="48px"
          className="h-[72px] w-12 shrink-0 rounded-md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <BookTitle
              book={reservation.book}
              className="line-clamp-2 font-display text-h3 font-semibold tracking-[-0.02em] text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
            />
            <StatusBadge status={reservation.status} />
          </div>

          <p className="mt-0.5 truncate text-small text-muted-foreground">
            {reservation.book.authors.join(", ") || "Unknown author"}
          </p>

          {ready ? (
            <>
              <p
                role="status"
                className="mt-2 flex items-center gap-1.5 font-display text-h3 font-semibold tracking-[-0.02em] text-success-ink"
              >
                <PackageCheck className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                Ready for pickup — {countdown} left
              </p>
              <p className="mt-1 text-small text-success-ink">{expiryNote}</p>
              <p className="mt-1 text-caption text-muted-foreground">
                Collect it from the circulation desk. Borrowing it needs no further action.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 flex items-center gap-1.5 text-small font-medium text-foreground">
                <Hourglass className="size-4 shrink-0 text-warning-ink" strokeWidth={1.75} aria-hidden="true" />
                {reservation.queuePosition
                  ? `You are #${reservation.queuePosition} in line for this book`
                  : "You are waiting for this book"}
              </p>
              <p className="mt-1 text-small text-muted-foreground">
                {reservation.queuePosition && reservation.queuePosition > 1
                  ? `${reservation.queuePosition - 1} ${reservation.queuePosition - 1 === 1 ? "reader is" : "readers are"} ahead of you. We will let you know as soon as a copy is returned.`
                  : reservation.queuePosition === 1
                    ? "You are next in the queue. A copy will be set aside for you when one is returned."
                    : "We will let you know as soon as a copy is returned."}
              </p>
            </>
          )}

          <p className="mt-1.5 text-caption text-muted-foreground">
            Requested {formatRequested(reservation.requestedAt)}
            {reservation.readyAt ? ` · ready since ${formatRequested(reservation.readyAt)}` : ""}
          </p>

          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              title={pending ? "Working on it…" : "Leave this queue"}
              onClick={() => onCancel(reservation)}
            >
              <XCircle className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {pending ? "Cancelling…" : "Cancel reservation"}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * A closed hold: one compact line, no actions.
 *
 * `fulfilled`, `cancelled` and `expired` are all terminal, so there is nothing to offer —
 * a control guaranteed to fail is worse than showing none. Each row says *which* of the
 * three it was, because "expired" and "cancelled" read very differently to somebody who came
 * here to find out why a book is still not on their loan record.
 */
export function ReservationHistoryRow({
  reservation,
  showBook = true,
}: {
  reservation: MemberReservation;
  showBook?: boolean;
}) {
  const note =
    reservation.status === "fulfilled"
      ? "Collected"
      : reservation.status === "expired"
        ? "Hold expired"
        : "Cancelled";

  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      {showBook ? (
        <BookCover
          publicId={reservation.book.cover?.publicId}
          url={reservation.book.cover?.url}
          title={reservation.book.title}
          author={reservation.book.authors[0] ?? null}
          width={32}
          sizes="32px"
          className="h-11 w-7 shrink-0 rounded-sm"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        {showBook ? (
          <BookTitle
            book={reservation.book}
            className="line-clamp-1 text-small font-medium text-foreground"
          />
        ) : null}
        <p className="text-caption text-muted-foreground">
          {note} &middot; requested {formatRequested(reservation.requestedAt)}
          {reservation.cancelledAt ? ` · ${formatRequested(reservation.cancelledAt)}` : ""}
          {reservation.status === "fulfilled" && reservation.fulfilledLoanId
            ? " · on your loan record"
            : ""}
        </p>
      </div>

      <StatusBadge status={reservation.status} />
    </li>
  );
}

/** Section heading shared by the three groups, with the count spelled out. */
export function ReservationSection({
  title,
  count,
  description,
  children,
}: {
  title: string;
  count: number;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`holds-${title.toLowerCase().replace(/\s+/g, "-")}`} className="space-y-4">
      <div>
        <h2
          id={`holds-${title.toLowerCase().replace(/\s+/g, "-")}`}
          className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
        >
          {title}
        </h2>
        <p aria-live="polite" className="text-small text-muted-foreground">
          {count} {count === 1 ? "book" : "books"} &middot; {description}
        </p>
      </div>
      {children}
    </section>
  );
}

/** Loading placeholders that match the card's real footprint. */
export function ReservationsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading your holds">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-start gap-4 rounded-lg border border-border bg-surface p-5">
          <div className="h-[72px] w-12 shrink-0 rounded-md bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="h-3 w-1/3 rounded bg-muted" />
            <div className="h-3 w-2/5 rounded bg-muted" />
          </div>
          <div className="h-10 w-32 shrink-0 rounded-md bg-muted" />
        </div>
      ))}
    </div>
  );
}

/** The icon a group's empty state uses. */
export function holdIcon(group: "ready" | "waiting" | "past") {
  if (group === "ready") return PackageCheck;
  if (group === "waiting") return Hourglass;
  return Clock;
}

/** `Requested 12 Mar 2026` — a short, unambiguous date for a hold timeline. */
function formatRequested(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}