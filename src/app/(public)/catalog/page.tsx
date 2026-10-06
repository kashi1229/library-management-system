import type { Metadata } from "next";
import { getCatalogFacets } from "@/lib/services/books";
import { CatalogBrowser } from "@/components/features/catalog/catalog-browser";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Browse every book in the Athenaeum library. Search by title, author or ISBN, and filter by category, language and availability.",
};

/**
 * The catalog reads its whole filter state from the URL, so it cannot be statically
 * prerendered — `useSearchParams()` in a prerendered route is a build error, not a
 * warning.
 *
 * Declared explicitly rather than hidden behind a `<Suspense>` boundary with a
 * spinner. A catalog whose result set changes with every keystroke is per-request
 * anyway, so a static shell would buy nothing, and the boundary would cost the two
 * things `ui-context.md` asks for: a visible spinner on first paint, and a subtree
 * replacement that discards anything the user has already typed. (That replacement is
 * exactly what cost the login page its first three keystrokes in Unit 08.)
 *
 * The *detail* page is unaffected — it reads `params`, not `searchParams`, so it stays
 * statically renderable.
 */
export const dynamic = "force-dynamic";

/**
 * Public catalog (F5).
 *
 * Facets are read **on the server** and handed to the client component, so the filter
 * panel has its category list on first paint instead of popping in a frame later.
 * Only the *results* are client-fetched, because those change with every keystroke.
 *
 * `getCatalogFacets` can only fail on a database problem, and a catalog with no
 * facets is still a usable catalog — so a failure degrades to an empty panel rather
 * than a 500 that hides the books entirely.
 */
export default async function CatalogPage() {
  const facets = await getCatalogFacets().catch(() => ({
    categories: [],
    languages: [],
    yearRange: { from: 2000, to: new Date().getFullYear() },
  }));

  return <CatalogBrowser facets={facets} />;
}