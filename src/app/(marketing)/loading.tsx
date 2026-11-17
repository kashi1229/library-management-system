import { Skeleton } from "@/components/ui/skeleton";

/**
 * Landing-page loading state (spec 20: every page carries a loading skeleton).
 *
 * Shaped like the hero's two columns at the hero's real paddings, so the paint that
 * follows the database does not shift the page. Only the hero is skeletoned on
 * purpose: every section below renders from the same `getPublicStats()` call and
 * arrives together, so a skeleton for the stats band would promise content that is
 * not actually any closer than the hero's.
 */
export default function Loading() {
  return (
    <section aria-busy="true" className="relative border-b border-border">
      <span className="sr-only">Loading the library…</span>
      <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-24">
        <div className="space-y-6">
          <Skeleton className="h-9 w-72 rounded-full" />
          <Skeleton className="h-14 w-[85%]" />
          <Skeleton className="h-14 w-[62%]" />
          <Skeleton className="h-4 w-[78%]" />
          <Skeleton className="h-12 w-full max-w-md rounded-md" />
          <div className="flex gap-3">
            <Skeleton className="h-11 w-40 rounded-md" />
            <Skeleton className="h-11 w-32 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[2/3] rounded-md" />
          ))}
        </div>
      </div>
    </section>
  );
}
