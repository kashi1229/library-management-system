"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BOOK_SORTS, type BookSort } from "@/lib/constants";
import type { BookStatusFilter } from "@/lib/validators/book";

/** Read one param, but only if it is a value we actually accept. */
function readEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * URL-synced filter state for the staff book table (spec 08).
 *
 * The URL is the single source of truth for `q`, `category`, `status`, `sort` and
 * `page`; this hook exposes them as plain values plus setters that write back
 * through the Next router.
 *
 * **History is per-kind, and that distinction matters.** Discrete choices — a
 * status tab, a category, a sort, a page — use `push`, so the back button undoes
 * them, which is what "shareable, survives a reload, plays with the back button"
 * in `project-overview.md` F5 asks for. The debounced search box uses `replace`,
 * because a keystroke must not create a history entry: typing "dune" would
 * otherwise take six presses of Back to undo.
 *
 * Two more details that are easy to get wrong:
 *
 * - **`draft` is the one piece of local state**, because the search box must stay
 *   responsive while the URL update is debounced. It is initialised from the URL
 *   and re-synced whenever the URL's `q` changes from outside (back button, or
 *   "Reset"), which is a render-time adjustment rather than an effect — a
 *   `setState` inside an effect would cascade a render on every keystroke.
 */
export function useBookFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const status = readEnum<BookStatusFilter>(
    searchParams.get("status"),
    ["active", "archived", "all"],
    "all",
  );
  const sort = readEnum<BookSort>(searchParams.get("sort"), BOOK_SORTS, "newest");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);

  const debounceTimer = React.useRef<number | undefined>(undefined);

  const [draft, setDraftState] = React.useState(q);

  /*
   * `draft` is local state because the search box must stay responsive while the
   * URL write is debounced, and the URL is the source of truth for everything
   * else. Reconciling the two is the entire difficulty, and both obvious approaches
   * silently **lose what the user typed**:
   *
   * - "Whenever `q` changes, copy it into `draft`" fires for the hook's *own*
   *   debounced write. Typing "Le Guin" over ~200ms commits "L" 350ms in, the URL
   *   becomes `?q=L`, and "L" overwrites a draft that already reads "Le Guin".
   * - Tracking "the last value I wrote" and comparing against it fails too, because
   *   `router.replace` settles a render *late*: for one render `useSearchParams()`
   *   still returns the previous query, so the comparison mismatches and the draft
   *   is cleared. The URL lagging behind our own write is indistinguishable from an
   *   external change.
   *
   * So focus is the signal. While the box has focus the user owns the value and the
   * debounce only ever moves the URL; once focus leaves, the two must agree and the
   * URL wins. That covers the back button, "Reset" and a shared link, none of which
   * involve typing, and it cannot misfire on the lagging URL.
   */
  const [editing, setEditing] = React.useState(false);
  if (!editing && draft !== q) setDraftState(q);

  const commit = React.useCallback(
    (
      next: Record<string, string | undefined>,
      options: { resetPage?: boolean; history?: "push" | "replace" } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      if (options.resetPage !== false) params.delete("page");

      const serialised = params.toString();
      const href = serialised ? `${pathname}?${serialised}` : pathname;
      const navigate = options.history === "replace" ? router.replace : router.push;
      navigate(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** Debounced so a fast typist issues one request, not one per keystroke. */
  const setDraft = React.useCallback(
    (value: string) => {
      setDraftState(value);

      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = window.setTimeout(() => {
        commit({ q: value || undefined }, { history: "replace" });
      }, 350);
    },
    [commit],
  );

  // Clear a pending write if the component unmounts, so it cannot fire into a
  // dead component after navigating away.
  React.useEffect(() => () => window.clearTimeout(debounceTimer.current), []);

  /**
   * Clear every filter in **one** navigation.
   *
   * The obvious implementation — `setDraft("")` then a separate `router.replace`
   * — issues two navigations, and the first schedules a debounced write that then
   * fights the second. Clearing the timer and letting the render-time sync
   * repopulate the draft keeps it to a single history entry.
   */
  const reset = React.useCallback(() => {
    window.clearTimeout(debounceTimer.current);
    setDraftState("");
    commit(
      { q: undefined, category: undefined, status: undefined, sort: undefined },
      { history: "push" },
    );
  }, [commit]);

  return { q, draft, setDraft, setEditing, category, status, sort, page, set: commit, reset };
}

export type BookFilters = ReturnType<typeof useBookFilters>;
