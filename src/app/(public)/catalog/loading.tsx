import { Skeleton } from "@/components/ui/skeleton";

/**
 * Catalog loading state (spec 20: every page carries a loading skeleton).
 *
 * Mirrors the browser's real structure — the desktop filter column, the toolbar row
 * and cover cards at the browser's own column rhythm (2 → 3 → 4 → 5, ui-context.md
 * §Layout Patterns) — so the skeletons land exactly where cards will and the first
 * client fetch does not shift the page.
 */
export default function Loading() {
  return (
    <div
      className="container-page grid gap-8 py-8 lg:grid-cols-[16rem_minmax(0,1fr)]"
      role="status"
    >
      <span className="sr-only">Loading the catalog…</span>

      {/* The filter column only exists from `lg` up, like the browser's own. */}
      <aside aria-hidden="true" className="hidden space-y-6 lg:block">
        <Skeleton className="h-5 w-24" />
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="space-y-2.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </aside>

      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 w-64 rounded-md" />
          <Skeleton className="h-11 w-36 rounded-md" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="aspect-[2/3] rounded-md" />
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
