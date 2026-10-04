"use client";

import type { LucideIcon } from "lucide-react";
import { ADMIN_NAV, MEMBER_NAV, STAFF_NAV, type NavItemConfig } from "@/lib/constants";
import { NAV_ICONS } from "@/lib/icons";

/**
 * Nav config with Lucide components resolved **once at module scope**.
 *
 * `lib/constants.ts` stores icon names as strings so it stays free of JSX and
 * can be imported by Server Components. This client module binds those names to
 * components at module load, which keeps the component references stable — the
 * React Compiler's `static-components` rule rejects a lookup performed during
 * render, because it would remount the subtree on every parent render.
 */

export type ResolvedNavItem = NavItemConfig & { Icon: LucideIcon };

function resolve(items: readonly NavItemConfig[]): ResolvedNavItem[] {
  return items.map((item) => ({
    ...item,
    Icon: NAV_ICONS[item.icon] ?? NAV_ICONS.LayoutDashboard,
  }));
}

export const RESOLVED_MEMBER_NAV = resolve(MEMBER_NAV);
export const RESOLVED_STAFF_NAV = resolve(STAFF_NAV);
export const RESOLVED_ADMIN_NAV = resolve(ADMIN_NAV);
