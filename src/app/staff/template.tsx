/**
 * Page transition (ui-context.md §Motion Language: fade + 8px rise).
 *
 * Sits inside `staff/layout.tsx`, so the AppShell — whose layout also fires the lazy
 * maintenance sweep — is never re-mounted by staff navigation; only the page content
 * fades in.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
