import { Skeleton } from "@/components/ui/skeleton";

/**
 * Book-detail loading state (spec 20: every page carries a loading skeleton).
 *
 * The two columns the page will paint — sticky cover left, information right,
 * stacked under `md` (ui-context.md §Layout Patterns) — at the same aspect ratio,
 * so the real cover does not push the page down when it arrives.
 */
export default function Loading() {
  return (
    <div
      className="container-page grid gap-10 py-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]"
      role="status"
    >
      <span className="sr-only">Loading the book…</span>

      <div>
        <Skeleton className="mx-auto aspect-[2/3] w-full max-w-80 rounded-md" />
      </div>

      <div className="space-y-5">
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="space-y-2 pt-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-[92%]" />
          <Skeleton className="h-3.5 w-[96%]" />
          <Skeleton className="h-3.5 w-[58%]" />
        </div>
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-36 rounded-md" />
          <Skeleton className="h-11 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}
