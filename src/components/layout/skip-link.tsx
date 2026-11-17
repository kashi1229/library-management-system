/**
 * Skip-to-content link (spec 20 accessibility checklist).
 *
 * **The first focusable element in the document.** A keyboard user tabbing into a
 * page lands here before the wordmark, the nav or the theme toggle, and jumping
 * straight to `<main id="main">` skips every repeated shell control on all of them.
 *
 * Rendered from the **root layout** rather than per shell, so the auth pages and
 * every error and not-found state carry it too — the shells are four different
 * trees, and four skip links is three more than one.
 *
 * A plain `<a>` on purpose: the target is on this page, so client-side routing
 * would only add a history entry and a re-render to a jump the browser does for
 * free. The `<main>` it points at carries `tabIndex={-1}` so focus actually moves.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className={`
        sr-only
        focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50
        focus:rounded-md focus:bg-primary focus:px-4 focus:py-2
        focus:text-small focus:font-medium focus:text-primary-foreground
        focus:shadow-lift focus:outline-none
      `}
    >
      Skip to content
    </a>
  );
}
