import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Skeletons that match the **actual** dashboard layouts.
 *
 * **The shared `PageSkeleton` was wrong for both pages.** It renders its KPI row at
 * `lg:grid-cols-4`, and the member dashboard has three cards at `lg:grid-cols-3` while the staff
 * dashboard has eight at four across. So the skeleton reserved four slots where three would
 * appear — the page shifted sideways on load — and the staff page reserved one row where two
 * would appear, which pushed everything below it down by a full card height.
 *
 * `ui-context.md` is explicit that skeletons match the final layout, and the shift is invisible
 * in a screenshot of the skeleton alone; it only shows when the two are compared.
 */
export function StaffDashboardSkeleton() {
  return (
    <div className="container-page space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the staff dashboard…</span>

      <HeaderSkeleton />

      {/* Eight cards, four across — two full rows, matching the real grid. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
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

      <Card>
        <CardHeader className="space-y-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[260px] w-full rounded-md" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton height={260} />
        <PanelSkeleton height={200} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ListPanelSkeleton rows={4} />
        <ListPanelSkeleton rows={4} />
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function MemberDashboardSkeleton() {
  return (
    <div className="container-page space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard…</span>

      <HeaderSkeleton />

      {/* A member with a ready hold sees the banner first, so the skeleton reserves it —
          otherwise the KPI row jumps up as soon as the data lands. */}
      <Skeleton className="h-[86px] w-full rounded-lg" />

      {/* Three cards at `lg:grid-cols-3`, not the four `PageSkeleton` uses. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
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

      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Card key={index} className="w-[15rem] shrink-0 gap-3 p-3 sm:w-[17rem]">
              <Skeleton className="h-[13rem] w-full rounded-md" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </Card>
          ))}
        </div>
      </div>

      <ShelfSkeleton />
      <ShelfSkeleton />
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-4 w-56" />
    </div>
  );
}

function PanelSkeleton({ height }: { height: number }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-1">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="w-full rounded-md" style={{ height }} />
      </CardContent>
    </Card>
  );
}

function ListPanelSkeleton({ rows }: { rows: number }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ShelfSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-44" />
      <div className="flex gap-4">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="w-[10rem] shrink-0 gap-2 p-2 sm:w-[11rem]">
            <Skeleton className="h-[10rem] w-full rounded-md" />
            <Skeleton className="h-3 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}