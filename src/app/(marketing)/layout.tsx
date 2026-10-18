import type { Metadata } from "next";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/services/settings";
import { PublicNav } from "@/components/layout/public-nav";
import { PublicFooter } from "@/components/layout/public-footer";

export const metadata: Metadata = {
  title: { default: "Athenaeum — Library Management System", template: "%s · Athenaeum" },
  description:
    "Search the catalog, reserve a title that is out on loan, and follow it from the queue to the shelf. Loans, renewals, fines and holds in one place.",
};

/**
 * The marketing shell that owns `/` (F17).
 *
 * **It reuses `PublicNav` and `PublicFooter` rather than growing a marketing pair.** The two
 * pages a visitor meets are the landing page and the catalog; giving each its own header means
 * two implementations of "translucent bar, wordmark, theme toggle, account" that drift within a
 * week, and the catalog is where the landing page sends everybody. The hide-on-scroll behaviour
 * the landing page asked for lives in `PublicNav` itself and is welcome on both.
 *
 * `getSession()` reads the **cookie only** — no database round trip — because `/` is the first
 * request an anonymous visitor makes. `getSettings()` is one cached read and supplies the live
 * library name, which is what makes the settings screen's rename actually reach the front door.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [session, settings] = await Promise.all([
    getSession().catch(() => null),
    getSettings().catch(() => null),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNav
        user={session ? { name: session.name, role: session.role } : null}
        libraryName={settings?.libraryName}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <PublicFooter
        libraryName={settings?.libraryName}
        contactEmail={settings?.contactEmail}
        className="mt-0"
      />
    </div>
  );
}