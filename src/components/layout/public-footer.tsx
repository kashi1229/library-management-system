import Link from "next/link";
import { Mail } from "lucide-react";
import { Logo } from "@/components/common/logo";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const COLUMNS = [
  {
    title: "Browse",
    links: [
      { href: ROUTES.catalog, label: "Catalog" },
      { href: `${ROUTES.catalog}?availability=available`, label: "Available now" },
      { href: `${ROUTES.catalog}?sort=rating`, label: "Highest rated" },
      { href: `${ROUTES.catalog}?sort=newest`, label: "New arrivals" },
    ],
  },
  {
    title: "Your account",
    links: [
      { href: ROUTES.member.loans, label: "My loans" },
      { href: ROUTES.member.reservations, label: "Reservations" },
      { href: ROUTES.member.wishlist, label: "Wishlist" },
      { href: ROUTES.member.fines, label: "Fines" },
    ],
  },
  {
    title: "Library",
    links: [
      { href: ROUTES.member.profile, label: "Profile" },
      { href: ROUTES.staff.books, label: "Staff sign-in" },
      { href: ROUTES.login, label: "Sign in" },
    ],
  },
] as const;

/**
 * Three-column footer (ui-context.md §Layout Patterns).
 *
 * The "Browse" column links into catalog filters rather than dead ends, so a footer
 * link is a real shortcut instead of a second copy of the nav bar.
 *
 * **The library name and contact email come from the Settings singleton**, because spec 19's
 * whole point is that an admin renaming the library sees it everywhere — including the footer,
 * which is the one place on a public page that is unambiguously "the library speaking". They
 * both fall back to defaults rather than rendering an empty slot: a footer with a blank line
 * where the contact should be is worse than a generic one.
 */

export function PublicFooter({
  libraryName = "Athenaeum",
  contactEmail = null,
  className,
}: {
  libraryName?: string;
  /** `null` when the library has not published one, in which case no row is rendered. */
  contactEmail?: string | null;
  className?: string;
}) {
  return (
    <footer className={cn("mt-16 border-t border-border bg-muted/30", className)}>
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo name={libraryName} />
          <p className="max-w-xs text-small text-pretty text-muted-foreground">
            A quiet, careful catalog for the university library. Borrow, reserve and keep
            track of what you have read.
          </p>
          {contactEmail ? (
            <p className="flex items-center gap-2 text-small text-muted-foreground">
              <Mail aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
              <a
                href={`mailto:${contactEmail}`}
                className="rounded-sm underline underline-offset-4 hover:text-foreground"
              >
                {contactEmail}
              </a>
            </p>
          ) : null}
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="space-y-3">
            <h2 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
              {column.title}
            </h2>
            <ul className="space-y-1">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-9 items-center rounded-md text-small text-muted-foreground transition-colors hover:text-foreground hover:underline underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="container-page flex flex-col gap-2 py-5 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{libraryName} Library Management System</p>
          <p>Cataloguing · Circulation · Reservations · Reports</p>
        </div>
      </div>
    </footer>
  );
}