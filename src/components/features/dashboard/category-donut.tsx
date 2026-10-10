"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { CATEGORY_COLOR_CLASS, type CategoryColor } from "@/lib/constants";
import type { DashboardCategoryShare } from "@/types";
import { categoryColorValue, useChartTokens } from "@/hooks/use-chart-tokens";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import {
  ChartEmpty,
  ChartFrame,
  ChartSkeleton,
  ChartTooltip,
} from "@/components/features/dashboard/chart-frame";

const PLOT_HEIGHT = 260;

/** Enough rows for eight categories plus headroom; a legend that scrolls hides the smallest slice. */
const MAX_LEGEND_ROWS = 8;

/**
 * Loans by category, as a donut with a legend.
 *
 * **The legend is not decoration — it is the axis.** A donut has no scale, so the numbers exist
 * only in the legend; a chart that renders colour rings with nothing beside them is unreadable.
 * Every row carries its share as a percentage, because a slice size alone cannot be read against
 * a number of twelve.
 *
 * **Category colours are fixed across themes** (`ui-context.md`): the hues live in `:root` and are
 * never flipped, because a category's colour is its identity. This is also why a dark-mode donut
 * does not need re-measuring — but it is measured through the same hook anyway, so there is one
 * path to a colour rather than a special case for this chart.
 */
export function CategoryDonut({ shares }: { shares: DashboardCategoryShare[] }) {
  const tokens = useChartTokens();
  const reduced = usePrefersReducedMotion();

  const total = shares.reduce((sum, share) => sum + share.count, 0);
  // A donut of equal zero slices is a grey ring that reads as "no data". Show the empty state.
  const hasData = total > 0;

  if (tokens === null) {
    return (
      <ChartFrame title="Loans by category" height={PLOT_HEIGHT}>
        <ChartSkeleton height={PLOT_HEIGHT} label="Loading the category chart" />
      </ChartFrame>
    );
  }

  if (!hasData) {
    return (
      <ChartFrame title="Loans by category" height={PLOT_HEIGHT}>
        <ChartEmpty
          icon={PieChartIcon}
          height={PLOT_HEIGHT}
          title="No loans yet"
          description="Nothing has been borrowed, so there is nothing to divide up."
        />
      </ChartFrame>
    );
  }

  const legend = shares.slice(0, MAX_LEGEND_ROWS);
  const hidden = shares.length - legend.length;

  return (
    <ChartFrame
      title="Loans by category"
      description={`${shares.length} ${shares.length === 1 ? "category" : "categories"} · ${total.toLocaleString("en-US")} loans`}
      height={PLOT_HEIGHT}
    >
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="w-full sm:w-1/2" style={{ height: PLOT_HEIGHT }}>
          <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
            <PieChart>
              <Pie
                data={shares}
                dataKey="count"
                nameKey="name"
                innerRadius="62%"
                outerRadius="88%"
                // **1px of surface between slices, not the token border colour** — the category
                // hues are adjacent in the palette and a hairline is what keeps two similar
                // greens from reading as one wedge.
                paddingAngle={shares.length > 1 ? 1 : 0}
                stroke={tokens.surface}
                strokeWidth={1}
                isAnimationActive={!reduced}
                animationDuration={450}
              >
                {shares.map((share) => (
                  <Cell key={share.id} fill={categoryColorValue(tokens, share.color)} />
                ))}
              </Pie>
              {/* **No `trigger` override.** recharts routes `touchstart`/`touchmove` through its
                  own `touchEventsMiddleware` and positions the tooltip relative to the finger, so
                  the default `hover` trigger already works under a finger — and `trigger` is a
                  single `'hover' | 'click'`, not a list. Setting it to `"click"` would be the
                  usual "make it work on touch" advice, and it would *break* touch: the finger
                  lands, the tooltip flickers, and dragging along the ring does nothing. */}
              <Tooltip content={<ChartTooltip tokens={tokens} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* `role="list"` because this is the chart's data table; without it a screen reader
            announces a run of unlabelled colour swatches and nothing else. */}
        <ul role="list" className="w-full min-w-0 flex-1 space-y-1.5">
          {legend.map((share) => {
            const percent = total === 0 ? 0 : Math.round((share.count / total) * 100);
            return (
              <li key={share.id} className="flex items-center gap-2 text-small">
                <span
                  aria-hidden="true"
                  className={`size-2.5 shrink-0 rounded-full ${swatchClass(share.color)}`}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{share.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {percent}%
                </span>
                <span className="w-10 shrink-0 text-end font-medium tabular-nums text-foreground">
                  {share.count.toLocaleString("en-US")}
                </span>
              </li>
            );
          })}
          {hidden > 0 ? (
            <li className="pt-1 text-caption text-muted-foreground">
              and {hidden} more {hidden === 1 ? "category" : "categories"} with no loans
            </li>
          ) : null}
        </ul>
      </div>
    </ChartFrame>
  );
}

/**
 * Tailwind class for the legend swatch, from the **one** category colour map.
 *
 * The swatch is a `<span>`, so it can take a class — unlike the slice, which is SVG and needs the
 * resolved value. Both come from the same record, so a swatch and its slice cannot disagree.
 */
function swatchClass(color: CategoryColor): string {
  return CATEGORY_COLOR_CLASS[color]?.bg ?? CATEGORY_COLOR_CLASS.forest.bg;
}