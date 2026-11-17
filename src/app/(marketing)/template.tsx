/**
 * Page transition (ui-context.md §Motion Language: fade + 8px rise).
 *
 * **Per route group, not at `src/app/`.** A template re-mounts its subtree on every
 * navigation *below this group's layout*. At root level that subtree includes the
 * app shell, so the drawer state, the collapsed sidebar and scroll position would
 * reset on every click; from here down, only the page content is replaced, which is
 * exactly the subtree that changes.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
