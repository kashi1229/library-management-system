import type { MetadataRoute } from "next";
import { listCatalogSlugs } from "@/lib/services/books";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * **Per request, never prerendered.** A sitemap.ts without this is generated at build
 * time, and a build has no database — the exact failure `staff/layout.tsx` documents
 * (`MongooseError: books.aggregate() buffering timed out`). A catalog changes on every
 * archival anyway, so a build-frozen sitemap would drift behind the page it describes.
 */
export const dynamic = "force-dynamic";

/**
 * The sitemap (spec 20 SEO checklist): the two public entry routes plus every active
 * catalog book.
 *
 * **A database problem degrades to the static routes, never to a 500.** The sitemap is
 * an SEO courtesy; withholding it because Mongo hiccuped would take the whole XML
 * document down with it. `login`/`register` are deliberately absent — they are
 * `noindex` at the page level, so listing them would contradict the page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await listCatalogSlugs().catch(() => []);

  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/catalog`, changeFrequency: "daily", priority: 0.9 },
    ...books.map((book) => ({
      url: `${siteUrl}/catalog/${book.slug}`,
      lastModified: book.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
