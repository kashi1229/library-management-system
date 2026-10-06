"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BOOK_AVAILABILITY, type BookAvailability } from "@/lib/constants";
import { PUBLIC_BOOK_SORTS, type PublicBookSort } from "@/lib/validators/book";

/**
 * URL-synced filter state for the public catalog (spec 09).
 *
 * The URL is the source of truth for `q`, `category`, `language`, `availability`,
 * `yearFrom`, `yearTo`, `sort` and `page`, so a filtered catalog is shareable,
 * survives a reload and plays with the back button.
 *
 * Three decisions worth recording:
 *
 * - **History is per-kind.** Discrete filter changes `push` so Back undoes them;
 *   the debounced search box `replace`s, because one history entry per keystroke
 *   would take seven presses of Back to undo "dune".
 * - **Draft/search reconciliation uses focus, not "did `q` change".** Copying the
 *   URL into the input whenever it moves fires for the hook's *own* debounced
 *   write and eats the characters typed since. It also fires on the render where
 *   `useSearchParams` still reports the *previous* query, because `router.replace`
 *   settles a render late. While the box has focus the user owns the value; once
 *   focus leaves, the URL wins. Same fix as `useBookFilters`, and Unit 08 lost a day
 *   finding it.
 * - **`view` (grid/list) is deliberately not in the URL.** It is a presentation
 *   preference, not a result set, and putting it in the address bar makes every
 *   shared link carry the sender's screen choice. It is persisted to localStorage
 *   by `CatalogBrowser` instead.
 */

/** Read one param, but only if it is a value we actually accept. */
function readEnum<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function readYear(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1000 && parsed <= 3000 ? parsed : undefined;
}

export function useCatalogFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const language = searchParams.get("language") ?? "";
  const availability = readEnum<BookAvailability>(
    searchParams.get("availability"),
    BOOK_AVAILABILITY,
    "all",
  );
  const sort = readEnum<PublicBookSort>(searchParams.get("sort"), PUBLIC_BOOK_SORTS, "newest");
  const yearFrom = readYear(searchParams.get("yearFrom"));
  const yearTo = readYear(searchParams.get("yearTo"));
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);

  const debounceTimer = React.useRef<number | undefined>(undefined);

  const [draft, setDraftState] = React.useState(q);
  const [editing, setEditing] = React.useState(false);

  // See the note above: only adopt the URL's value when the box is not being typed
  // into. Adjusting during render is React's documented way to derive state from
  // props; an effect would paint one frame of the stale value first.
  if (!editing && draft !== q) setDraftState(q);

  const commit = React.useCallback(
    (
      next: Record<string, string | number | undefined>,
      options: { resetPage?: boolean; history?: "push" | "replace" } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
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
      }, 300);
    },
    [commit],
  );

  React.useEffect(() => () => window.clearTimeout(debounceTimer.current), []);

  /**
   * Clear every filter in **one** navigation.
   *
   * `setDraft("")` followed by a separate `router.replace` would be two navigations,
   * and the first schedules a debounced write that then fights the second.
   */
  const reset = React.useCallback(() => {
    window.clearTimeout(debounceTimer.current);
    setDraftState("");
    commit(
      {
        q: undefined,
        category: undefined,
        language: undefined,
        availability: undefined,
        yearFrom: undefined,
        yearTo: undefined,
        sort: undefined,
      },
      { history: "push" },
    );
  }, [commit]);

  /** How many filters are narrowing the results, for the "N filters" badge. */
  const activeCount = [
    q,
    category,
    language,
    availability === "available" ? availability : "",
    yearFrom ?? yearTo ? "year" : "",
    sort !== "newest" ? sort : "",
  ].filter(Boolean).length;

  return {
    q,
    draft,
    setDraft,
    setEditing,
    category,
    language,
    availability,
    sort,
    yearFrom,
    yearTo,
    page,
    activeCount,
    set: commit,
    reset,
  };
}

export type CatalogFilters = ReturnType<typeof useCatalogFilters>;