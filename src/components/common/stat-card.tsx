"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/common/count-up";

type StatTone = "default" | "accent" | "danger" | "success" | "warning" | "info";

type StatCardProps = {
  label: string;
  value: number;
  /**
   * How to render the number. Defaults to `toLocaleString`.
   *
   * **Needed for money.** A card whose label is "Unpaid total" and whose value is `20`
   * reads as twenty of something; `$20.00` reads as twenty currency units. `CountUp`
   * animates the raw number and `format` is applied to the animated value, so the count-up
   * still works and the currency symbol appears on every frame rather than popping in at
   * the end.
   */
  format?: (value: number) => string;
  /** Rendered after the number, e.g. `"copies"`. */
  suffix?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone?: StatTone;
  /** Secondary line under the number, e.g. "3 due today". */
  hint?: ReactNode;
  className?: string;
};

/**
 * KPI card. The number counts up once when the card scrolls into view
 * (ui-context.md §Motion Language) and renders its final value immediately when
 * motion is reduced.
 */
export function StatCard({
  label,
  value,
  format,
  suffix,
  icon: Icon,
  tone = "default",
  hint,
  className,
}: StatCardProps) {
  const accent = TONE_STYLES[tone];
  const render = format ?? ((n: number) => n.toLocaleString("en-US"));

  return (
    <Card className={cn("gap-3 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-small font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <span aria-hidden="true" className={cn("grid size-9 shrink-0 place-items-center rounded-md", accent.icon)}>
            <Icon className="size-[18px]" strokeWidth={1.75} />
          </span>
        ) : null}
      </div>
      <p className="flex items-baseline gap-1.5">
        <CountUp value={value} format={render} className={cn("font-display text-h2 font-semibold tracking-[-0.02em] tabular-nums", accent.value)} />
        {suffix ? <span className="text-small text-muted-foreground">{suffix}</span> : null}
      </p>
      {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

/** Same footprint as `StatCard`, so KPI grids never shift while loading. */
export function StatCardSkeleton() {
  return (
    <Card className="gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9 rounded-md" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-20" />
    </Card>
  );
}

const TONE_STYLES = {
  default: { value: "text-foreground", icon: "bg-muted text-muted-foreground" },
  accent: { value: "text-accent-ink", icon: "bg-accent-soft text-accent-ink" },
  danger: { value: "text-danger-ink", icon: "bg-danger-soft text-danger-ink" },
  success: { value: "text-success-ink", icon: "bg-success-soft text-success-ink" },
  warning: { value: "text-warning-ink", icon: "bg-warning-soft text-warning-ink" },
  info: { value: "text-info-ink", icon: "bg-info-soft text-info-ink" },
} as const;
