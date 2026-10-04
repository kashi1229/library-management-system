import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StyleGuide } from "./style-guide";

export const metadata: Metadata = {
  title: "Style Guide",
  robots: { index: false, follow: false },
};

/**
 * Temporary visual proof of the design system (Unit 01).
 *
 * Private folders (leading underscore) are excluded from the router, so the
 * reachable path is `/styleguide` via the `(styleguide)` group. The route is
 * compiled out of production builds by hard-404ing on `NODE_ENV=production`.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();

  return <StyleGuide />;
}
