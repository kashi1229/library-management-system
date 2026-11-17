import type { MetadataRoute } from "next";

/** Same origin the metadata resolves against — one place, `app/layout.tsx`, would be
 *  nicer, but metadata files are evaluated independently and reading a constant here
 *  keeps them order-free. Falls back the same way the layout does. */
const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * robots.txt (spec 20 SEO checklist).
 *
 * **The staff area and the API are disallowed; everything else is crawlable.** The
 * member pages sit behind a session and answer a redirect to a crawler, so there is
 * nothing to protect — a robots rule is not authorisation, and pretending otherwise
 * would be listing member URLs as private when they are merely useless to a crawler.
 * The login and register pages are `noindex` at the page level (spec 04), which is
 * the right mechanism for "reachable, but not in the index".
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/staff/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
