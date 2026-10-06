import { PageSkeleton } from "@/components/common/page-skeleton";

/**
 * Route-level loading state for the member detail page.
 *
 * The page itself is fast (one user read plus five counts), but a server component
 * with `await` still yields to the router, and without this Next paints an empty
 * viewport for a beat. `PageSkeleton` mirrors the page's real shape — heading, then a
 * row, then content — so nothing reflows when it lands.
 */
export default function Loading() {
  return <PageSkeleton />;
}
