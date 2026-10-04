import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Route-level loading skeleton (`loading.tsx` companion).
 *
 * Mirrors the final page shape — header block, stat row, content panel — so the
 * transition into real content does not shift the layout (ui-context.md:
 * "Skeletons match final layout").
 */
export function PageSkeleton({
  stats = 0,
  panels = 1,
}: {
  /** Number of KPI cards to reserve. */
  stats?: number;
  /** Number of content panels below the KPI row. */
  panels?: number;
}) {
  return (
    <div className="container-page space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      {stats > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <Card key={index} className="gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-9 rounded-md" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </Card>
          ))}
        </div>
      ) : null}

      {Array.from({ length: panels }, (_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
