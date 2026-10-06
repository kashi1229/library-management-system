"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEMBER_NAV, STAFF_NAV, ADMIN_NAV, type NavItemConfig } from "@/lib/constants";

/** Flatten every nav config so a path can be resolved back to its label. */
const ALL_ITEMS: NavItemConfig[] = [...MEMBER_NAV, ...STAFF_NAV, ...ADMIN_NAV];

/**
 * Breadcrumb trail derived from the nav config, so labels and routes can never
 * drift apart. Unknown segments fall back to a humanised version of the slug.
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  // `/staff/books` → [staff, books]
  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const item = ALL_ITEMS.find((entry) => entry.href === href);
    return { href, label: item?.label ?? humanise(segment), isLast: index === segments.length - 1 };
  });

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 text-caption text-muted-foreground">
        <li className="flex items-center">
          <Link
            href="/dashboard"
            aria-label="Home"
            className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
          >
            <Home className="size-3.5" strokeWidth={1.75} />
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex min-w-0 items-center">
            {/*
              Intermediate segments are hidden on the narrowest screens. The Topbar
              has very little room at 360px, so "Dashboard" truncated to a 21px-wide
              sliver — a pointer target below WCAG 2.2 SC 2.5.8's 24x24, on a link
              that is not exempt as inline text. Showing only the current page is
              the standard mobile pattern and removes the problem rather than
              shrinking the type further.
            */}
            <span className={crumb.isLast ? undefined : "hidden items-center sm:flex"}>
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 opacity-50" />
            </span>
            {crumb.isLast ? (
              <span aria-current="page" className="truncate font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hidden min-h-6 truncate py-0.5 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none sm:inline-block"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function humanise(segment: string): string {
  const spaced = segment.replace(/[-_]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
