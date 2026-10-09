"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RatingSummary } from "@/lib/api-client";

/**
 * The rating summary: one large average plus the five distribution bars (spec 15).
 *
 * **The average is large and serif because it is the answer.** A reader deciding whether a
 * book is worth borrowing wants one number first and the spread second; giving the bars more
 * visual weight than the figure inverts that.
 *
 * **The bars are real counts, never reconstructed from the mean.** An average of 4.3 from
 * twelve ratings could be eleven 5s and one 1, or a genuine spread — and those two books
 * deserve very different confidence from a reader. The service aggregates the whole
 * collection (not the visible page) so the bars do not change as you page through.
 *
 * Each bar is a real `role="progressbar"` with its own `aria-label`, so the distribution is
 * available to a screen reader as numbers rather than as five decorative rectangles. The
 * alternative — five widths with no text — is a chart nobody can read.
 *
 * With no ratings the whole block says so once, rather than drawing five empty bars beside
 * a `0.0`, which reads as "this book is rated zero" rather than "nobody has rated it".
 */
export function RatingSummaryPanel({
  summary,
  className,
}: {
  summary: RatingSummary;
  className?: string;
}) {
  const { average, count, distribution } = summary;

  if (count === 0) {
    return (
      <p className={cn("text-small text-muted-foreground", className)}>
        No ratings yet. Members who borrow this book can leave the first one.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8", className)}>
      {/* ------------------------------ The average ----------------------------- */}
      <div className="shrink-0 text-center sm:text-start">
        <p className="font-display text-h1 font-semibold tracking-[-0.03em] tabular-nums text-foreground">
          {average.toFixed(1)}
        </p>
        <div className="mt-1 flex items-center justify-center gap-0.5 sm:justify-start">
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              aria-hidden="true"
              strokeWidth={1.5}
              className={cn(
                "size-4",
                index < Math.round(average) ? "fill-accent text-accent" : "text-border",
              )}
            />
          ))}
        </div>
        <p className="mt-1 text-caption text-muted-foreground">
          {count} {count === 1 ? "rating" : "ratings"}
        </p>
      </div>

      {/* ------------------------------ The spread ------------------------------ */}
      <ul className="flex-1 space-y-1.5">
        {distribution.map((value, index) => {
          // Index 0 is one star, so the label runs 5 down to 1 to match how people read a
          // rating chart from the top.
          const stars = 5 - index;
          const percent = count > 0 ? Math.round((value / count) * 100) : 0;

          return (
            <li key={stars} className="flex items-center gap-3">
              <span className="flex w-8 shrink-0 items-center gap-0.5 text-caption text-muted-foreground">
                {stars}
                <Star aria-hidden="true" className="size-3 fill-current" strokeWidth={0} />
              </span>

              {/*
               * A real progressbar, because five coloured rectangles with no text are a
               * chart no screen reader can read. `aria-label` carries the sentence.
               */}
              <span
                role="progressbar"
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={count}
                aria-label={`${value} ${value === 1 ? "rating" : "ratings"} gave ${stars} ${stars === 1 ? "star" : "stars"}`}
                className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${percent}%` }}
                />
              </span>

              {/* Kept visible, not `sr-only`: the number beside the bar is the fastest read. */}
              <span className="w-8 shrink-0 text-end text-caption tabular-nums text-muted-foreground">
                {value}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}