"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { SuspendedBanner } from "@/components/layout/suspended-banner";
import { COLLAPSE_KEY, SidebarStateProvider, type SidebarState } from "@/components/layout/sidebar-state";
import { ROUTES } from "@/lib/constants";
import type { PublicUser } from "@/types";

/** Widths from ui-context.md: 264px expanded, 72px icon rail when collapsed. */
const SIDEBAR_WIDTH = { expanded: 264, collapsed: 72 } as const;

type ShellVariant = "member" | "staff";

/**
 * Shared application shell for the member and staff areas.
 *
 * Layout (ui-context.md §Layout Patterns):
 *   ≥1024px  264px sidebar (collapsible to a 72px rail) + sticky topbar
 *   <1024px  sidebar becomes a left Sheet opened from the topbar hamburger
 *   <768px   the member area also gets a five-item bottom tab bar
 *
 * The shell is a Client Component because it owns the collapse preference, the
 * drawer and the tab bar. The user is resolved **on the server** and passed in,
 * so there is no client-side fetch and no auth flash.
 */
export function AppShell({
  user,
  variant,
  children,
  libraryName,
}: {
  user: PublicUser;
  variant: ShellVariant;
  children: React.ReactNode;
  libraryName?: string;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // One source of truth for the collapse preference, shared with `Sidebar` so
  // the aside actually resizes instead of the rail collapsing inside a fixed box.
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(COLLAPSE_KEY, false);

  const sidebarState = React.useMemo<SidebarState>(
    () => ({
      collapsed,
      setCollapsed,
      toggle: () => setCollapsed(!collapsed),
    }),
    [collapsed, setCollapsed],
  );

  const suspended = user.status === "suspended";

  /** Staff search is a command palette in Unit 11; for members it opens the catalog. */
  const handleSearch = React.useCallback(() => {
    router.push(variant === "staff" ? `${ROUTES.staff.books}?focus=search` : `${ROUTES.catalog}?focus=search`);
  }, [router, variant]);

  return (
    <SidebarStateProvider value={sidebarState}>
      <div className="flex min-h-dvh bg-background">
        {/* ---------------------------- Desktop sidebar ----------------------------- */}
        <aside
          style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
          className="hidden shrink-0 border-r border-border lg:block"
        >
          <div className="sticky top-0 h-dvh">
            <Sidebar role={user.role} libraryName={libraryName} />
          </div>
        </aside>

        {/* ------------------------------ Main column ------------------------------ */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={user}
            onOpenNav={() => setDrawerOpen(true)}
            onSearch={handleSearch}
            searchLabel={variant === "staff" ? "Search books and members" : "Search the catalog"}
          />

          {suspended ? <SuspendedBanner reason={user.suspendedReason} /> : null}

          <main
            id="main-content"
            className={cn(
              "flex-1 py-6 sm:py-8",
              // Leave room for the bottom tab bar on small member screens.
              variant === "member" && "pb-24 md:pb-10",
              "px-4 sm:px-6 lg:px-8",
            )}
          >
            {children}
          </main>
        </div>

        {/* -------------------------------- Drawer --------------------------------- */}
        <MobileNav
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          role={user.role}
          libraryName={libraryName}
        />

        {/* ----------------------------- Bottom tab bar ---------------------------- */}
        {variant === "member" ? <BottomTabBar /> : null}
      </div>
    </SidebarStateProvider>
  );
}
