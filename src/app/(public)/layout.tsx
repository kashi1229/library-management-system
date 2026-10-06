import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { PublicNav } from "@/components/layout/public-nav";
import { PublicFooter } from "@/components/layout/public-footer";

export const metadata: Metadata = {
  title: { default: "Athenaeum Library", template: "%s · Athenaeum" },
  description: "Browse the Athenaeum library catalog, reserve books and track your loans.",
};

/**
 * Public shell for the catalog and the book detail page (F5).
 *
 * Deliberately **not** `AppShell`: a visitor has no sidebar, no breadcrumbs and no
 * notifications, and putting them behind one would mean rendering an authenticated
 * navigation for someone who cannot use it.
 *
 * `getSession()` reads the **cookie only** — no database round trip — so this layout
 * stays cheap on a page any anonymous visitor can reach. It is used solely to decide
 * whether the navbar offers "Sign in" or initials for the account menu; it is never
 * authorisation, and these routes are public either way. Anything that genuinely needs
 * a live record (status, avatar, membership id) goes through `requireSession()`.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNav user={session ? { name: session.name, role: session.role } : null} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}