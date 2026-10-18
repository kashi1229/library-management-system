import { handler, ok } from "@/lib/api";
import { getPublicStats } from "@/lib/services/public-stats";

/**
 * GET /api/public/stats - public, no session required.
 *
 * The landing page reads the service **directly** rather than going through HTTP (a Server
 * Component calling a service is both `code-standards.md`'s preference and one less round trip),
 * so this route exists for the API contract and for anything that wants the figures without
 * rendering the page.
 *
 * **Sixty-second cache.** These four counts move slowly and the page is the first thing an
 * anonymous visitor sees, so recomputing four aggregates per hit is waste. The trade is explicit:
 * an admin who adds a book sees the count move within a minute, and nothing on this payload is
 * user-specific, so nobody reads a figure that belongs to somebody else.
 *
 * `loansThisMonth`, `newArrivals` and `categories` all move with the same 60s clock — a cached
 * hero beside a live count-up would be two different libraries.
 */
export const revalidate = 60;

export const GET = handler(async () => ok(await getPublicStats()), {
  name: "GET /api/public/stats",
});