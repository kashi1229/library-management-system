import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Athenaeum library account.",
  robots: { index: false, follow: false },
};

/**
 * Read `?next=` here, on the server, and hand it to the form as a prop.
 *
 * This used to be `useSearchParams()` inside `LoginForm`, wrapped in `<Suspense>`
 * with a spinner fallback so the page could stay statically prerendered. The cost
 * was subtle and real: on first load Next renders the static shell, then *replaces*
 * the whole subtree once the client can read the query string. That replacement
 * re-creates the DOM, so anything the user had already typed is thrown away —
 * reproduced consistently as the first three characters of an email address
 * disappearing (`qa.member@…` arriving as `member@…`) when typing began during the
 * swap. It also cost a visible spinner flash on the most-used page in the app.
 *
 * Reading the param in the Server Component removes both problems: no
 * `useSearchParams` in the client tree means no bailout, so the form is interactive
 * the moment it paints.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.next;
  const next = Array.isArray(raw) ? raw[0] : raw;

  return <LoginForm next={next ?? null} />;
}