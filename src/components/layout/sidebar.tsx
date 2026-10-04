"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { useSidebarState } from "@/components/layout/sidebar-state";
import type { Role } from "@/lib/constants";
import {
  RESOLVED_ADMIN_NAV,
  RESOLVED_MEMBER_NAV,
  RESOLVED_STAFF_NAV,
  type ResolvedNavItem,
} from "@/components/layout/nav-items";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarItem } from "@/components/layout/sidebar-item";

type NavSection = { title: string | null; items: readonly ResolvedNavItem[] };
/** Split the role's items into Main / Manage / Admin sections. */
export function navSections(role: Role): NavSection[] {
  const isStaff = role === "librarian" || role === "admin";
  const source = isStaff ? RESOLVED_STAFF_NAV : RESOLVED_MEMBER_NAV;

  const primary = source.filter((item) => item.roles.includes(role));
  const admin = role === "admin" ? RESOLVED_ADMIN_NAV : [];

  if (!isStaff) return [{ title: null, items: primary }];

  return [
    { title: null, items: primary.slice(0, 4) },
    { title: "Manage", items: primary.slice(4) },
    ...(admin.length > 0 ? [{ title: "Admin", items: admin }] : []),
  ];
}

/**
 * Left navigation.
 *
 * 264px expanded, 72px icon rail when collapsed (persisted in localStorage).
 * A librarian never sees the Admin section, because `navSections` filters by
 * role rather than relying on the caller to hide it.
 */
export function Sidebar({
  role,
  libraryName,
  onNavigate,
  className,
}: {
  role: Role;
  libraryName?: string;
  /** Provided when rendered inside the mobile Sheet so the drawer can close. */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebarState();
  const reduced = usePrefersReducedMotion();
  const sections = React.useMemo(() => navSections(role), [role]);

  // The mobile drawer is always expanded; collapse is a desktop affordance.
  const isRail = collapsed && !onNavigate;

  return (
    <div className={cn("flex h-full flex-col bg-surface", className)}>
      <div
        className={cn(
          "flex h-16 shrink-0 items-center px-4",
          isRail ? "justify-center" : "justify-between gap-2",
        )}
      >
        <Logo markOnly={isRail} name={libraryName} className="min-w-0" />
      </div>

      <Separator />

      <nav
        aria-label="Main navigation"
        className={cn("flex-1 space-y-6 overflow-y-auto py-4", isRail ? "px-2" : "px-3")}
      >
        {sections.map((section, index) =>
          section.items.length === 0 ? null : (
            <div key={section.title ?? `section-${index}`} className="space-y-1">
              {section.title && !isRail ? (
                <p className="px-3 pb-1 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
                  {section.title}
                </p>
              ) : null}
              {section.items.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  Icon={item.Icon}
                  pathname={pathname}
                  collapsed={isRail}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ),
        )}
      </nav>

      {/* Collapse control is desktop-only; the drawer has no reason for it. */}
      {!onNavigate ? (
        <div className={cn("shrink-0 border-t border-border p-2", isRail && "flex justify-center")}>
          <Button
            variant="ghost"
            size={isRail ? "icon" : "sm"}
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className={cn(!isRail && "w-full justify-start gap-3")}
          >
            <motion.span
              initial={false}
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={reduced ? transitions.fast : { type: "spring", stiffness: 400, damping: 32 }}
              className="grid place-items-center"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" strokeWidth={1.75} />
              ) : (
                <PanelLeftClose className="size-4" strokeWidth={1.75} />
              )}
            </motion.span>
            {!isRail ? <span>Collapse</span> : null}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
