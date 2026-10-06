"use client";

import { cn } from "@/lib/utils";

/**
 * Availability as a sentence plus a row of pips (spec 09).
 *
 * The pips are **one element per copy**, not a progress bar: on a library shelf the
 * meaningful question is "which of the five can I have", and a bar answers a
 * different one. With more than 12 copies the row stops drawing pips and falls back
 * to the sentence alone, so a 999-copy textbook does not render 999 elements.
 *
 * The copy count is exposed through the same `role="img"` sentence as the stars, so
 * assistive tech hears "3 of 5 available" instead of five indistinguishable glyphs.
 */
export function AvailabilityBadge({
  available,
  total,
  /** People waiting ahead — the reason a book with no free copy is not "gone". */
  queueLength = 0,
  size = "md",
  className,
}: {
  available: number;
  total: number;
  queueLength?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const safeTotal = Math.max(0, total);
  const safeAvailable = Math.min(safeTotal, Math.max(0, available));

  const none = safeAvailable === 0;
  const low = !none && safeAvailable <= 1;

  const tone = none
    ? "text-danger-ink"
    : low
      ? "text-warning-ink"
      : "text-muted-foreground";

  const pipActive = none
    ? "bg-danger"
    : low
      ? "bg-warning"
      : "bg-success";

  const showPips = safeTotal > 0 && safeTotal <= 12;
  const pipSize = size === "sm" ? "size-1.5" : "size-2";

  const label = none
    ? queueLength > 0
      ? `All copies out · ${queueLength} ${queueLength === 1 ? "person" : "people"} waiting`
      : "All copies out"
    : `${safeAvailable} of ${safeTotal} available`;

  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <span role="img" aria-label={label} className={cn("inline-flex items-center gap-1.5", tone)}>
        {showPips ? (
          <span className="flex items-center gap-0.5" aria-hidden="true">
            {Array.from({ length: safeTotal }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "rounded-full",
                  pipSize,
                  index < safeAvailable ? pipActive : "bg-border",
                )}
              />
            ))}
          </span>
        ) : null}
        <span className={cn("whitespace-nowrap", size === "sm" ? "text-caption" : "text-small")}>
          {none
            ? queueLength > 0
              ? `${safeTotal === 0 ? "None" : `All ${safeTotal} out`} · ${queueLength} waiting`
              : "All copies out"
            : `${safeAvailable} of ${safeTotal} available`}
        </span>
      </span>
    </span>
  );
}