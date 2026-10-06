"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only star rating (spec 09).
 *
 * Two details that make it honest rather than decorative:
 *
 * - **The stars are decorative and the number is not.** A screen reader announcing
 *   five separate "star" icons tells a user nothing, so the glyph row is
 *   `aria-hidden` and a single `role="img"` carries the full sentence: *"4.3 out of 5,
 *   from 12 ratings"*.
 * - **The fill is a clipped overlay, not per-star math**, so 4.3 renders as four
 *   full stars plus a precisely 30%-filled fifth one instead of rounding to 4.
 */
export function StarRating({
  value,
  count,
  size = "md",
  showValue = true,
  className,
}: {
  /** Mean rating, 0–5. `0` with no count renders as "No ratings yet". */
  value: number;
  count: number;
  size?: "sm" | "md";
  showValue?: boolean;
  className?: string;
}) {
  const clamped = Math.min(5, Math.max(0, Number.isFinite(value) ? value : 0));
  const percent = (clamped / 5) * 100;
  const starClass = size === "sm" ? "size-3" : "size-3.5";

  const label =
    count > 0
      ? `${clamped.toFixed(1)} out of 5, from ${count} ${count === 1 ? "rating" : "ratings"}`
      : "No ratings yet";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span role="img" aria-label={label} className="relative inline-flex shrink-0">
        {/* Outline row. */}
        <span className="flex gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className={cn(starClass, "text-border")} strokeWidth={1.5} />
          ))}
        </span>
        {/* Filled row, clipped to the rating. */}
        <span
          className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden"
          style={{ width: `${percent}%` }}
          aria-hidden="true"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              className={cn(starClass, "shrink-0 fill-accent text-accent")}
              strokeWidth={1.5}
            />
          ))}
        </span>
      </span>

      {showValue ? (
        count > 0 ? (
          <span className="text-caption whitespace-nowrap text-muted-foreground">
            <span className="font-medium text-foreground">{clamped.toFixed(1)}</span>
            {count > 0 ? ` (${count})` : null}
          </span>
        ) : (
          <span className="text-caption whitespace-nowrap text-muted-foreground">New</span>
        )
      ) : null}
    </span>
  );
}