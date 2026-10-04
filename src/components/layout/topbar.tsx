"use client";

import * as React from "react";
import { Menu, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { PublicUser } from "@/types";

/**
 * Topbar: mobile menu trigger, breadcrumb/page title, search, bell, theme and
 * the account menu.
 *
 * The right cluster keeps a stable width so the controls never shift as the
 * bell badge appears in Unit 16.
 */
export function Topbar({
  user,
  onOpenNav,
  searchLabel = "Search the catalog",
  onSearch,
  actions,
}: {
  user: PublicUser;
  /** Opens the mobile drawer. */
  onOpenNav: () => void;
  searchLabel?: string;
  /** Staff search opens a command palette in Unit 11; member search jumps to the catalog. */
  onSearch?: () => void;
  /** Optional page-level action rendered before the icon cluster. */
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.75} />
      </Button>

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {actions}

        {/* Wide enough to be useful on desktop; collapses to an icon on mobile. */}
        <Button
          variant="ghost"
          onClick={onSearch}
          aria-label={searchLabel}
          className="hidden h-11 gap-2 border border-transparent px-3 text-muted-foreground hover:border-border hover:bg-muted md:inline-flex"
        >
          <Search className="size-4" strokeWidth={1.75} />
          <span className="text-small">Search</span>
          <kbd className="ml-2 hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline">
            /
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSearch}
          aria-label={searchLabel}
          className="md:hidden"
        >
          <Search className="size-[18px]" strokeWidth={1.75} />
        </Button>

        <NotificationBell />
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}

/** Standard "create" action slot, used by staff page headers. */
export function TopbarCreateAction({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <Button size="sm" onClick={onClick} className="hidden sm:inline-flex">
      <Plus className="size-4" />
      {label}
    </Button>
  );
}
