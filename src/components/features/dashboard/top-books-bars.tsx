"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardTopBook } from "@/types";
import { useChartTokens } from "@/hooks/use-chart-tokens";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { ChartEmpty, ChartFrame } from "@/components/features/dashboard/chart-frame";

const ROW_HEIGHT = 38;
const PLOT_HEIGHT = 5 * ROW_HEIGHT;

/**
 * Top five borrowed books, as horizontal bars.
 *
 * **Horizontal, not vertical, because a book title is words.** A vertical bar chart turns five
 * titles into five rotated, clipped labels, and the reader is left comparing angles. Horizontal
 * bars give each title the full column width and the comparison becomes length, which is the
 * thing a bar chart is actually good at.
 *
 * **Bars are HTML, not recharts.** Five labelled rows with a proportional fill are a list with a
 * width on it; SVG would mean a `<text>` truncation algorithm, a custom tooltip and a chart
 * legend, in exchange for nothing. The axis *is* the bar length, and the number is printed beside
 * it, so no scale is needed.
 */
export function TopBooksBars({ books }: { books: DashboardTopBook[] }) {
  const tokens = useChartTokens();
  const reduced = usePrefersReducedMotion();

  const max = books.reduce((peak, book) => Math.max(peak, book.borrowCount), 0);

  if (tokens === null || max === 0) {
    return (
      <ChartFrame title="Most borrowed" height={books.length === 0 ? 160 : PLOT_HEIGHT}>
        {tokens === null ? (
          <div aria-busy="true" aria-live="polite" style={{ height: PLOT_HEIGHT }} className="space-y-2">
            <span className="sr-only">Loading the most-borrowed list</span>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-3 flex-1 animate-pulse rounded-full bg-muted" style={{ width: `${100 - index * 12}%` }} />
                <div className="h-3 w-8 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <ChartEmpty
            icon={BookOpen}
            height={160}
            title="Nothing borrowed yet"
            description="The five most-borrowed titles will appear here."
          />
        )}
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      title="Most borrowed"
      description={`Top ${books.length} of all time`}
      height={PLOT_HEIGHT}
    >
      <ul role="list" className="space-y-1">
        {books.map((book) => {
          const percent = Math.max(4, Math.round((book.borrowCount / max) * 100));
          return (
            <li key={book.id} className="flex items-center gap-3 py-1">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small text-foreground">{book.title}</span>
                <span
                  className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <span
                    className={cn("block h-full rounded-full")}
                    style={{
                      width: `${percent}%`,
                      backgroundColor: tokens.primary,
                      transition: reduced ? undefined : "width 450ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </span>
              </span>
              <span className="w-12 shrink-0 text-end text-small font-medium tabular-nums text-foreground">
                {book.borrowCount.toLocaleString("en-US")}
              </span>
            </li>
          );
        })}
      </ul>
    </ChartFrame>
  );
}