"use client";

import { cn } from "@/lib/utils";

/**
 * Availability for one book: "2 of 5 available" plus a thin bar.
 *
 * The bar carries a `role="progressbar"` with real `aria-valuenow`, so the
 * figure is available to assistive tech and not just to the eye. Tone follows
 * `ui-context.md` §StatusBadge: `available` = success, `low` (≤1 copy) =
 * warning, `unavailable` = danger. A fully stocked shelf is deliberately quiet
 * so an almost-empty one is what draws the eye down the column.
 */
export function CopiesBar({
  available,
  total,
  showLabel = true,
  className,
}: {
  available: number;
  total: number;
  showLabel?: boolean;
  className?: string;
}) {
  // `total` is read below for the ratio and the aria-valuemax. Both counts are
  // clamped, so a stale row from a cached API response cannot render a bar that
  // overflows or reports more copies than exist.
  const safeTotal = Math.max(0, total);
  const safeAvailable = Math.min(safeTotal, Math.max(0, available));
  const ratio = safeTotal === 0 ? 0 : Math.round((safeAvailable / safeTotal) * 100);

  const tone = toneFor(safeAvailable);

  return (
    <div className={cn("min-w-[7.5rem]", className)}>
      {showLabel ? (
        // Not `whitespace-nowrap`: in a narrow table column a nowrap label makes
        // `scrollWidth` exceed the cell, which is real overflow. Letting it wrap is
        // the only option that never truncates and never spills.
        <p className="text-caption">
          <span className={cn("font-semibold", tone.text)}>{safeAvailable}</span>
          <span className="text-muted-foreground"> of {safeTotal} available</span>
        </p>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={safeAvailable}
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-label={`${safeAvailable} of ${safeTotal} copies available`}
        className={cn("mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted", tone.fill)}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-300", tone.bar)}
          style={{ width: `${Math.max(ratio, safeTotal > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
}

/** The single availability rule, shared with the availability cell. */
export function toneFor(
  available: number,
): { bar: string; text: string; fill: string; label: string } {
  if (available <= 0) {
    return {
      bar: "bg-danger-ink",
      text: "text-danger-ink",
      fill: "bg-danger-soft",
      label: "None available",
    };
  }
  if (available <= 1) {
    return {
      bar: "bg-warning-ink",
      text: "text-warning-ink",
      fill: "bg-warning-soft",
      label: "Low stock",
    };
  }
  return {
    bar: "bg-success-ink",
    text: "text-success-ink",
    fill: "bg-success-soft",
    label: "Available",
  };
}
