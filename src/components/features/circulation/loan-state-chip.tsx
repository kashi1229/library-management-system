"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LoanDisplayState, LoanSummary } from "@/lib/api-client";

/**
 * The loan's state chip, with a **countdown** (spec 12).
 *
 * The chip is `StatusBadge` — the mapping from `on_time` / `due_soon` / `overdue` /
 * `returned` to a tone is already specified in `ui-context.md`, and re-declaring it here
 * is how a screen ends up painting "due soon" in a colour nobody chose.
 *
 * What this adds is the *time*. "Due in 3 days" and "6 days late" are the facts a
 * librarian and a member both act on, and a bare amber chip forces them to count days in
 * their head. Both come from `daysLeft` / `daysOverdue`, which the **server** derived
 * (Unit 11) — never recomputed here, or the desk and "My Loans" would disagree about
 * whether a book is late.
 */
export function LoanStateChip({
  loan,
  className,
  showCountdown = true,
}: {
  loan: Pick<LoanSummary, "view" | "daysLeft" | "daysOverdue">;
  className?: string;
  showCountdown?: boolean;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <StatePill view={loan.view} />
      {showCountdown ? <Countdown loan={loan} view={loan.view} /> : null}
    </span>
  );
}

function StatePill({ view }: { view: LoanDisplayState }) {
  const label: Record<LoanDisplayState, string> = {
    on_time: "On time",
    due_soon: "Due soon",
    overdue: "Overdue",
    returned: "Returned",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-medium whitespace-nowrap",
        view === "on_time" && "bg-success-soft text-success-ink",
        view === "due_soon" && "bg-warning-soft text-warning-ink",
        view === "overdue" && "bg-danger-soft text-danger-ink",
        view === "returned" && "bg-muted text-muted-foreground",
      )}
    >
      {/* The dot takes the `-ink` colour too, never the raw hue: raw status colours only
          reach 2.5-3.2:1 on their own tint and fail WCAG AA (ui-context.md). */}
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label[view]}
    </span>
  );
}

/**
 * The countdown phrase.
 *
 * Deliberately worded as **whole days**, because that is the unit the fine is charged in.
 * "Today" and "Tomorrow" are used where they read better than "0 days" / "1 day", because
 * a librarian saying "due today" needs no arithmetic.
 */
function Countdown({ loan, view }: { loan: Pick<LoanSummary, "daysLeft" | "daysOverdue">; view: LoanDisplayState }) {
  const text =
    view === "returned"
      ? null
      : view === "overdue"
        ? `${loan.daysOverdue} ${loan.daysOverdue === 1 ? "day" : "days"} late`
        : loan.daysLeft === 0
          ? "Due today"
          : loan.daysLeft === 1
            ? "Due tomorrow"
            : `Due in ${loan.daysLeft} days`;

  if (!text) return null;

  return (
    <span
      className={cn(
        "text-caption whitespace-nowrap",
        view === "overdue" ? "font-medium text-danger-ink" : "text-muted-foreground",
      )}
    >
      {text}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Countdown ring (member "My Loans")                                          */
/* -------------------------------------------------------------------------- */

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * A circular days-left ring (spec 12).
 *
 * The number is rendered as **real text**, not inside the SVG, so it scales with the
 * type ramp, is selectable, and is announced by a screen reader. The SVG is decoration
 * that follows the number rather than containing it.
 *
 * Progress is `daysLeft / loanPeriod` clamped to `[0, 1]`: the ring empties as the due
 * date approaches. **`loanPeriod` is passed in, not fetched here** — the policy comes from
 * the public settings endpoint, and a second source for the loan period is a second answer
 * to "how long is a loan".
 *
 * `aria-hidden` on the graphic plus `role="status"` on the number means the member hears
 * "3 days left" once, not a bare SVG.
 */
export function CountdownRing({
  daysLeft,
  loanPeriod,
  size = 84,
  className,
}: {
  daysLeft: number;
  loanPeriod: number;
  size?: number;
  className?: string;
}) {
  const overdue = daysLeft < 0;
  const clamped = Math.max(0, Math.min(loanPeriod, daysLeft));
  const fraction = loanPeriod > 0 ? clamped / loanPeriod : 0;

  // Colour follows urgency, and the `-ink` token is used for the stroke so it keeps AA
  // contrast against the card rather than being a decorative raw hue.
  const stroke = overdue ? "var(--color-danger-ink)" : daysLeft <= 3 ? "var(--color-warning-ink)" : "var(--color-success-ink)";
  const textTone = overdue
    ? "text-danger-ink"
    : daysLeft <= 3
      ? "text-warning-ink"
      : "text-success-ink";

  const label = overdue
    ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? "day" : "days"} late`
    : daysLeft === 0
      ? "Due today"
      : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;

  return (
    <div
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 84 84"
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={42}
          cy={42}
          r={RING_RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={5}
        />
        {/* Starts full and drains: `strokeDasharray` is the circumference, `offset` the
            remaining arc. A dash offset past the circumference renders nothing rather
            than wrapping, which is why it is clamped above. */}
        <circle
          cx={42}
          cy={42}
          r={RING_RADIUS}
          fill="none"
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
        />
      </svg>

      <span className="absolute inset-0 grid place-items-center">
        <span className="text-center leading-none">
          <span className={cn("block font-display text-h2 font-semibold tabular-nums", textTone)}>
            {overdue ? Math.abs(daysLeft) : daysLeft}
          </span>
          <span className="mt-0.5 block text-caption text-muted-foreground">
            {overdue ? "late" : daysLeft === 1 ? "day" : "days"}
          </span>
        </span>
      </span>
    </div>
  );
}