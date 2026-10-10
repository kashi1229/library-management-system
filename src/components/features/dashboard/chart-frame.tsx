"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartTokens } from "@/hooks/use-chart-tokens";

/**
 * The chrome every dashboard chart shares: title, the sentence saying what it is, the body, and
 * an aside.
 *
 * **One shell so the three charts cannot drift in padding, header weight or height.** The first
 * draft gave each chart its own `Card` and they differed by a few pixels of padding within the
 * hour, which is invisible in code review and obvious on the page.
 */
export function ChartFrame({
  title,
  description,
  action,
  /** Fixed pixel height for the plot area. Also the skeleton's height — see `ChartSkeleton`. */
  height,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  height: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      {/* `flex-wrap` because the title, the sentence and an optional action are three siblings
          that cannot all fit one line at 360px. Without it the frame's own header is what
          widens the page. */}
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-x-4 gap-y-2 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle className="font-display text-h3 font-semibold tracking-[-0.02em]">
            {title}
          </CardTitle>
          {description ? (
            <p className="text-small text-muted-foreground text-pretty">{description}</p>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="flex-1">
        <div style={{ minHeight: height }}>{children}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Placeholder for a chart that has not been measured yet.
 *
 * **`height` is the chart's real height, not a guess.** `useChartTokens()` returns `null` until
 * the client has measured the cascade, so the skeleton is what the server paints; if it were a
 * different height the chart would shove the page down by the difference the moment it appeared.
 */
export function ChartSkeleton({ height, label }: { height: number; label: string }) {
  return (
    <div
      className="flex flex-col justify-end gap-3"
      style={{ height }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      {/* A baseline and a few columns of roughly the right height, so the shape reads as a chart
          rather than as a grey box — while never claiming a value it does not have. */}
      <div className="flex flex-1 items-end gap-2 px-1">
        {[38, 62, 44, 78, 55, 30, 66, 48].map((height, index) => (
          <Skeleton key={index} className="flex-1 rounded-t-sm" style={{ height: `${height}%` }} />
        ))}
      </div>
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

/**
 * The "no data" panel a chart shows instead of an empty axis.
 *
 * **A drawn, labelled, axis-shaped void is worse than a sentence.** A reader who sees an empty
 * grid with 0–30 on the y-axis concludes the chart is broken; the sentence says which is true,
 * and says what to do about it. `icon` is decorative and `aria-hidden`, because the title and
 * description already carry the meaning — announcing the glyph adds a second, useless item.
 */
export function ChartEmpty({
  icon: Icon,
  title,
  description,
  height,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description?: string;
  height: number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border px-6 text-center"
      style={{ height }}
    >
      <span aria-hidden="true" className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="text-small font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-xs text-caption text-muted-foreground text-pretty">{description}</p>
      ) : null}
    </div>
  );
}

/**
 * The recharts tooltip, restyled onto the tokens.
 *
 * **Recharts ships a default tooltip painted with hardcoded `#fff`/`#000`**, which is legible in
 * light mode and a white slab on a dark surface. Every chart here passes `<Tooltip content={…} />`
 * with this instead, so there is one tooltip appearance and it follows the theme.
 *
 * **`surface`/`foreground` come from `ChartTokens` rather than a class** for the same reason the
 * chart strokes do: SVG content cannot take a Tailwind class, and recharts writes these strings
 * directly into inline `style`. The *border* and *shadow* are ordinary CSS classes because they
 * are applied to the wrapper element, not written by recharts.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  tokens,
  labelFormatter,
}: {
  active?: boolean;
  label?: React.ReactNode;
  payload?: ReadonlyArray<{ name?: string; value?: number | string; color?: string; payload?: unknown }>;
  tokens: ChartTokens;
  /** Formats the x-axis key — a date needs different phrasing from a category name. */
  labelFormatter?: (label: React.ReactNode) => React.ReactNode;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-md border border-border px-3 py-2 shadow-lift"
      style={{ backgroundColor: tokens.surface, color: tokens.foreground }}
    >
      {label !== undefined && label !== null ? (
        <p className="mb-1 text-caption font-medium">{labelFormatter ? labelFormatter(label) : label}</p>
      ) : null}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2 text-caption">
            {entry.color ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
            ) : null}
            <span style={{ color: tokens.mutedForeground }}>{entry.name}</span>
            <span className="font-semibold tabular-nums">
              {typeof entry.value === "number" ? entry.value.toLocaleString("en-US") : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Axis/grid defaults, so all three charts share one grid weight.
 *
 * **A grid line strong enough to read on the area chart competes with the donut, which has no
 * grid at all.** `--border` at this opacity is present enough to read a value against and quiet
 * enough to stay behind the data.
 */
export const GRID_STROKE_OPACITY = 0.6;

export function chartAxisProps(tokens: ChartTokens) {
  return {
    stroke: tokens.border,
    tick: { fill: tokens.mutedForeground, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  } as const;
}