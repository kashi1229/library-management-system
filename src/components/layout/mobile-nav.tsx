"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import type { Role } from "@/lib/constants";

/**
 * Mobile navigation drawer.
 *
 * Below 1024px the sidebar becomes this Sheet, opened from the topbar hamburger
 * (ui-context.md §Layout Patterns). Radix handles the focus trap, Escape and
 * the outside-click dismissal.
 */
export function MobileNav({
  open,
  onOpenChange,
  role,
  libraryName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
  libraryName?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0" aria-describedby="mobile-nav-desc">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription id="mobile-nav-desc">Move between sections of the library system.</SheetDescription>
        </SheetHeader>
        <Sidebar role={role} libraryName={libraryName} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
