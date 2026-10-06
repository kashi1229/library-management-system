import Link from "next/link";
import { Logo } from "@/components/common/logo";
import { ROUTES } from "@/lib/constants";

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
 */
export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo name="Athenaeum" />
          <p className="max-w-xs text-small text-pretty text-muted-foreground">
            A quiet, careful catalog for the university library. Borrow, reserve and keep
            track of what you have read.
          </p>
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
          <p>Athenaeum Library Management System</p>
          <p>Cataloguing · Circulation · Reservations · Reports</p>
        </div>
      </div>
    </footer>
  );
}