"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { DashboardDayPoint } from "@/types";
import { useChartTokens } from "@/hooks/use-chart-tokens";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import {
  ChartEmpty,
  ChartFrame,
  ChartSkeleton,
  ChartTooltip,
  GRID_STROKE_OPACITY,
  chartAxisProps,
} from "@/components/features/dashboard/chart-frame";

const PLOT_HEIGHT = 260;

/**
 * Loans per day over the configured window.
 *
 * **The series arrives already zero-filled** (`services/dashboard.ts`), and that is load-bearing
 * rather than cosmetic: a `$group` returns only days that had loans, so charting the raw result
 * draws a straight line across a quiet fortnight and makes a library that lent two books last
 * Tuesday look steadily busy. The gaps are the information.
 */
export function LoansAreaChart({ series, days }: { series: DashboardDayPoint[]; days: number }) {
  const tokens = useChartTokens();
  const reduced = usePrefersReducedMotion();

  const total = series.reduce((sum, point) => sum + point.count, 0);

  if (tokens === null) {
    return (
      <ChartFrame title="Loans per day" height={PLOT_HEIGHT} description={`Last ${days} days`}>
        <ChartSkeleton height={PLOT_HEIGHT} label="Loading the loans-per-day chart" />
      </ChartFrame>
    );
  }

  if (total === 0) {
    return (
      <ChartFrame title="Loans per day" height={PLOT_HEIGHT} description={`Last ${days} days`}>
        <ChartEmpty
          icon={BarChart3}
          height={PLOT_HEIGHT}
          title="No loans yet"
          description={`Nothing has been issued in the last ${days} days. The chart will fill in as books go out.`}
        />
      </ChartFrame>
    );
  }

  return (
    <ChartFrame
      title="Loans per day"
      description={`Last ${days} days · ${total.toLocaleString("en-US")} issued`}
      height={PLOT_HEIGHT}
    >
      <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
        <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <defs>
            {/* `primary → accent`, so the wash reads warm at the base and cool at the line. A
                single-colour fill over 30 points greys out the quiet days it is meant to show. */}
            <linearGradient id="loansPerDayFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.28} />
              <stop offset="100%" stopColor={tokens.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke={tokens.border}
            strokeOpacity={GRID_STROKE_OPACITY}
          />
          <XAxis
            dataKey="date"
            {...chartAxisProps(tokens)}
            minTickGap={24}
            tickFormatter={shortDate}
          />
          <YAxis {...chartAxisProps(tokens)} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ stroke: tokens.border }}
            content={
              <ChartTooltip tokens={tokens} labelFormatter={(value) => longDate(value)} />
            }
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Loans"
            stroke={tokens.primary}
            strokeWidth={2}
            fill="url(#loansPerDayFill)"
            // **Animated once, and only when motion is welcome.** recharts animates on mount by
            // default, which means a chart below the fold animates before anybody sees it.
            isAnimationActive={!reduced}
            animationDuration={450}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/**
 * `2026-10-08` → `8 Oct`.
 *
 * **`parseISO`, not `new Date(...)`.** The key is a bare UTC date, and `new Date("2026-10-08")`
 * parses it as UTC midnight — which in any negative-offset timezone is the *previous* local day.
 * The first version did that, and every tick before noon was labelled a day early. `parseISO`
 * plus an explicit formatter reads the calendar fields rather than an instant.
 */
function shortDate(value: string): string {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "d MMM");
}

function longDate(value: React.ReactNode): React.ReactNode {
  if (typeof value !== "string") return value;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "EEEE d MMMM yyyy");
}