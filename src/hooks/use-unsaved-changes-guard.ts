"use client";

import * as React from "react";

/**
 * Guard unsaved form edits against accidental navigation (spec 08).
 *
 * Two distinct mechanisms, because one is not enough:
 *
 * 1. **Browser-level navigation** (reload, close tab, back to another site) needs
 *    the native `beforeunload` prompt. Browsers ignore custom wording there by
 *    design, which is exactly why the in-app case is handled separately.
 * 2. **In-app navigation** (a sidebar link, a breadcrumb, the browser back button)
 *    must be intercepted explicitly, because `beforeunload` never fires for a
 *    Next.js client-side transition.
 *
 * For (2) the Navigation API is used when available, since it is the only thing
 * that catches the hardware **back button** — that fires no click event. Where it
 * is missing, same-origin link clicks are intercepted in the capture phase, which
 * covers every navigation in this app.
 *
 * The hook **never navigates itself**. It reports the destination through
 * `onBlocked` so the host owns both the confirmation UI and the navigation, which
 * keeps the transition client-side. Calling `window.location.assign` here would
 * force a full page reload and discard the Next router state.
 *
 * A hook rather than a wrapper component because `dirty` is conditional: mounting
 * an effect conditionally is what `react-hooks/set-state-in-effect` and the React
 * Compiler reject. Registering and removing listeners in an effect keyed on `dirty`
 * satisfies both rules and is correct.
 *
 * @returns `allowNavigation` must be called immediately before a navigation the
 *   host initiates itself. See the note on that function.
 */
export function useUnsavedChangesGuard({
  dirty,
  onBlocked,
}: {
  dirty: boolean;
  /**
   * Called with the destination the user tried to reach. The host owns both the
   * confirmation UI and the navigation, so the transition stays client-side.
   */
  onBlocked: (href: string) => void;
}) {
  // Refs rather than state, so the listeners always see the current values without
  // re-registering on every render. Named `*Ref` because that is what tells the
  // React Compiler these are mutable refs and not render-time values.
  const onBlockedRef = React.useRef(onBlocked);
  React.useEffect(() => {
    onBlockedRef.current = onBlocked;
  });

  const bypassRef = React.useRef(false);

  /**
   * Authorise the navigation the host is about to perform.
   *
   * Necessary because `dirty` is React state and cannot be cleared synchronously.
   * `form.reset()` followed by `router.push()` in the same tick leaves the listener
   * installed with `dirty === true`, and Next's router fires `navigate` *during* the
   * push — so the guard cancels the form's own post-save redirect, the save appears
   * to do nothing, and the user is left staring at the form they just saved.
   *
   * Deliberately **not** consumed on first use. Next's router can emit more than
   * one `navigate` event for a single `push` (the RSC request and then the URL
   * commit), and a flag that cleared itself after the first one let the second
   * through unchallenged… in reverse: it blocked it, so "Discard changes" silently
   * did nothing. The flag is instead cleared when the form becomes clean, which is
   * exactly the moment it stops being meaningful.
   */
  const allowNavigation = React.useCallback(() => {
    bypassRef.current = true;
  }, []);

  /** True while a host-initiated navigation is in flight. */
  const isBypassed = React.useCallback(() => bypassRef.current, []);

  // Drop the bypass once there is nothing to protect, so a later genuine attempt to
  // leave is guarded again.
  React.useEffect(() => {
    if (!dirty) bypassRef.current = false;
  }, [dirty]);

  /* --------------------------- 1. beforeunload --------------------------- */
  React.useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Both lines are required: `preventDefault` for current browsers,
      // `returnValue` for older ones. Neither is styleable.
      event.preventDefault();
      event.returnValue = UNSAVED_MESSAGE;
      return UNSAVED_MESSAGE;
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  /* --------------------- 2a. Navigation API (back button) ---------------- */
  React.useEffect(() => {
    if (!dirty) return;

    // `navigation` is not in every lib.dom version yet, so it is read off `window`
    // defensively and the whole branch is skipped when unsupported.
    const nav = (window as unknown as { navigation?: MinimalNavigation }).navigation;
    if (!nav?.addEventListener) return;

    const onNavigate = (event: Event) => {
      const url = (event as Event & { destination?: { url?: string } }).destination?.url;
      if (!url) return;
      if (isBypassed()) return;

      const target = new URL(url, window.location.href);
      // Leaving the site entirely is `beforeunload`'s job.
      if (target.origin !== window.location.origin) return;
      if (isSamePage(target)) return;

      event.preventDefault();
      onBlockedRef.current(target.href);
    };

    nav.addEventListener("navigate", onNavigate);
    return () => nav.removeEventListener("navigate", onNavigate);
  }, [dirty, isBypassed]);

  /* ------------------------ 2b. link-click fallback --------------------- */
  React.useEffect(() => {
    if (!dirty) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      // Respect the browser's own new-tab / new-window gestures.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      // `closest` walks up from whatever was clicked, so a click on an icon inside
      // the link still resolves to the link itself.
      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute("download") || anchor.target === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("#") || /^(mailto|tel|javascript):/.test(href)) return;

      const target = new URL(href, window.location.href);
      if (target.origin !== window.location.origin) return;
      if (isSamePage(target)) return;
      if (isBypassed()) return;

      // Capture phase: the guard must run before Next's own router handler, or the
      // transition has already started by the time we stop it.
      event.preventDefault();
      event.stopPropagation();
      onBlockedRef.current(target.href);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, isBypassed]);

  return { allowNavigation };
}

/** True when `target` is the page already being viewed, hash changes aside. */
function isSamePage(target: URL): boolean {
  const here = window.location;
  return (
    target.pathname === here.pathname &&
    target.search === here.search &&
    target.hash === here.hash
  );
}

/**
 * Only ever reaches the `beforeunload` return value, which browsers replace with
 * their own wording. Module scope so the listener is not re-registered per render.
 */
const UNSAVED_MESSAGE = "You have unsaved changes. Leave this page?";

/** The two members of the Navigation API this hook uses. */
type MinimalNavigation = {
  addEventListener: (type: "navigate", listener: (event: Event) => void) => void;
  removeEventListener: (type: "navigate", listener: (event: Event) => void) => void;
};