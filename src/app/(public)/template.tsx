/**
 * Page transition (ui-context.md §Motion Language: fade + 8px rise).
 *
 * Per route group rather than at `src/app/` — a root template would re-mount the
 * app shell on navigation and reset its state; this one replaces only the page
 * below the public nav, which is the part that changes.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
