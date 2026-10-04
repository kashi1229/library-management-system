"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { transitions } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { NavItemConfig } from "@/lib/constants";

type SidebarItemProps = {
  item: NavItemConfig;
  /** Component resolved once at module scope in `nav-items.ts`. */
  Icon: LucideIcon;
  /** Route currently displayed, used for the active state. */
  pathname: string;
  /** Collapsed icon-rail mode hides the label and shows a tooltip instead. */
  collapsed?: boolean;
  /** Mobile drawer: always shows the label, and closes on navigation. */
  onNavigate?: () => void;
};

/** True when `pathname` is this item's route or a child of it. */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // `/staff` and `/dashboard` are prefixes of their own children, so they must
  // only match exactly — otherwise the dashboard stays lit on every sub-page.
  if (href === "/staff" || href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

/**
 * One navigation row.
 *
 * The active state uses a `layoutId` pill so the highlight slides between items
 * instead of cutting, which is what makes the sidebar feel considered. Under
 * reduced motion the pill renders without animating.
 */
export function SidebarItem({ item, Icon, pathname, collapsed = false, onNavigate }: SidebarItemProps) {
  const active = isActive(pathname, item.href);
  const reduced = usePrefersReducedMotion();

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-md px-3 text-small font-medium",
        "transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none",
        collapsed && "justify-center px-0",
        active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId={reduced ? undefined : "sidebar-active-pill"}
          aria-hidden="true"
          className="absolute inset-0 rounded-md bg-primary-soft"
          transition={reduced ? transitions.fast : { type: "spring", stiffness: 380, damping: 34 }}
        />
      ) : null}

      <span className="relative z-10 grid size-4 shrink-0 place-items-center">
        <Icon className="size-4" strokeWidth={active ? 2 : 1.75} />
      </span>
      {!collapsed ? <span className="relative z-10 truncate">{item.label}</span> : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}
