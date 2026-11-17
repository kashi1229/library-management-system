/**
 * Page transition (ui-context.md §Motion Language: fade + 8px rise).
 *
 * Sits **inside** `(member)/layout.tsx`, so the AppShell it lives in is never
 * re-mounted by a navigation — the notification bell's polling, the drawer and the
 * collapsed sidebar all survive; only the page content fades in.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
