import { handler, ok } from "@/lib/api";
import { getCatalogFacets } from "@/lib/services/books";

/**
 * GET /api/books/facets — public.
 *
 * Everything the catalog filter panel needs in one response: category counts with
 * their icon and accent, the languages actually present, and the publication year
 * bounds. Public because the filter panel is on the public catalog, and because
 * none of it reveals anything about an individual — counts are over active books.
 *
 * Declared as its own route rather than `GET /api/books?facets=1`: a flag that
 * swaps the response *shape* inside a list endpoint is the kind of ambiguity that
 * later turns into a wrong read, and this keeps the list endpoint's contract flat.
 */
export const GET = handler(async () => ok({ facets: await getCatalogFacets() }), {
  name: "GET /api/books/facets",
});