/**
 * Page transition (ui-context.md §Motion Language: fade + 8px rise).
 *
 * Wraps the two-panel auth shell. The form's own content animates a stagger from
 * `initial="hidden"` on mount, so a template at root level would double-animate the
 * same entrance; this fades the whole panel in first, as one motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
