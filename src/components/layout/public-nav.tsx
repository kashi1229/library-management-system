"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { initials } from "@/lib/utils";
import { ROUTES, type Role } from "@/lib/constants";

/** Nav entries a signed-in member still gets on a public page. */
const LINKS = [
  { href: ROUTES.catalog, label: "Catalog" },
  { href: ROUTES.member.wishlist, label: "Wishlist", signedInOnly: true },
  { href: ROUTES.member.loans, label: "My Loans", signedInOnly: true },
  { href: ROUTES.member.profile, label: "Profile", signedInOnly: true },
] as const;

/**
 * Public navbar: logo left, links centre-left, theme toggle and account right.
 *
 * `ui-context.md` §Layout Patterns calls for a *sticky translucent* bar, so the
 * background is `bg-background/80` with a backdrop blur and the border only appears
 * once the page has scrolled — a permanently visible rule reads heavier than the
 * editorial style wants.
 *
 * Links are underlined on the active route so the current page is legible without
 * relying on colour alone.
 */
export function PublicNav({
  user,
}: {
  /** Minimal identity, or `null` for a visitor. */
  user: { name: string; role: Role } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  const visible = React.useMemo(
    () => LINKS.filter((link) => !("signedInOnly" in link) || Boolean(user)),
    [user],
  );

  // The header is 64px, and the page scrolls under it.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Close on navigate. Done in the click, not in an effect on `pathname` —
   *  `setState` inside an effect cascades a render, and React's compiler rejects it. */
  const closeOnNavigate = () => setOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm transition-[border-color]",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <div className="container-page flex h-16 items-center gap-4">
        <Link
          href={ROUTES.catalog}
          className="shrink-0 rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
        >
          <Logo name="Athenaeum" />
          <span className="sr-only">Athenaeum catalog home</span>
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 items-center gap-1 md:flex">
          {visible.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-small transition-colors hover:bg-muted",
                "focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none",
                pathname.startsWith(link.href)
                  ? "font-medium text-foreground underline decoration-accent decoration-2 underline-offset-[6px]"
                  : "text-muted-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle />

          {user ? (
            <Link
              href={ROUTES.member.profile}
              className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
            >
              {/* Initials, not the avatar image: the session token carries a name but
                  no avatar, and re-reading the user record on every public page load
                  would put a database round trip in front of every visitor. */}
              <Avatar className="size-9">
                <AvatarFallback className="bg-primary-soft text-primary">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">Your account</span>
            </Link>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href={ROUTES.login}>Sign in</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href={ROUTES.register}>Join</Link>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {/* Mobile panel. In-flow rather than a Sheet: it is a short list, and a modal
          would trap focus for a navigation the user can see plainly. */}
      {open ? (
        <div
          id="public-mobile-nav"
          className="border-t border-border bg-surface md:hidden"
        >
          <nav aria-label="Main" className="container-page flex flex-col py-2">
            {visible.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeOnNavigate}
                aria-current={pathname.startsWith(link.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md px-3 text-body transition-colors hover:bg-muted",
                  pathname.startsWith(link.href)
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
            {!user ? (
              <div className="mt-2 flex gap-2 border-t border-border pt-3 pb-1">
                <Button asChild variant="outline" className="flex-1">
                  <Link href={ROUTES.login} onClick={closeOnNavigate}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href={ROUTES.register} onClick={closeOnNavigate}>
                    Join
                  </Link>
                </Button>
              </div>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}