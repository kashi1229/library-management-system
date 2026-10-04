"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Home, Library, BookMarked, Heart, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { ROUTES } from "@/lib/constants";

/**
 * Bottom tab bar for the member area under 768px (ui-context.md).
 * Five destinations only — the rest stay reachable from the drawer and the
 * topbar, so nothing becomes unreachable on a phone.
 */
const TABS = [
  { label: "Home", href: ROUTES.member.dashboard, icon: Home },
  { label: "Catalog", href: ROUTES.catalog, icon: Library },
  { label: "Loans", href: ROUTES.member.loans, icon: BookMarked },
  { label: "Wishlist", href: ROUTES.member.wishlist, icon: Heart },
  { label: "Profile", href: ROUTES.member.profile, icon: UserRound },
] as const;

export function BottomTabBar({ className }: { className?: string }) {
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  return (
    <nav
      aria-label="Quick navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden",
        className,
      )}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1",
                  "text-caption font-medium transition-colors duration-150",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none focus-visible:-outline-offset-2",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={reduced ? undefined : "bottom-tab-indicator"}
                    aria-hidden="true"
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                    transition={reduced ? transitions.fast : { type: "spring", stiffness: 400, damping: 34 }}
                  />
                ) : null}
                <Icon className="size-5" strokeWidth={active ? 2 : 1.75} />
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
