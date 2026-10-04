"use client";

import * as React from "react";

/**
 * Collapse state for the desktop sidebar.
 *
 * Both `AppShell` (which sizes the aside) and `Sidebar` (which renders the rail
 * and the toggle button) need the same value, so it lives in one context backed
 * by `useLocalStorage`. Without this the aside keeps its 264px width while the
 * sidebar collapses inside it, and the collapse appears to do nothing.
 */
export type SidebarState = {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
};

/** localStorage key holding the collapse preference. */
export const COLLAPSE_KEY = "athenaeum:sidebar-collapsed";

const SidebarStateContext = React.createContext<SidebarState | null>(null);

export function SidebarStateProvider({
  value,
  children,
}: {
  value: SidebarState;
  children: React.ReactNode;
}) {
  return <SidebarStateContext.Provider value={value}>{children}</SidebarStateContext.Provider>;
}

/** Read the collapse state. Throws if used outside `AppShell`. */
export function useSidebarState(): SidebarState {
  const context = React.useContext(SidebarStateContext);
  if (!context) {
    throw new Error("useSidebarState must be used inside <AppShell>.");
  }
  return context;
}
