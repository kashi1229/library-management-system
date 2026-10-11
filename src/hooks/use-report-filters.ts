"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * URL-synced filter state for the reports screens (spec 18).
 *
 * Identical rules to `use-loan-filters.ts` and `use-member-filters.ts`, on purpose:
 *
 * - **the URL is the source of truth** for `from`, `to`, `categoryId` and `page`, so a filtered
 *   report is shareable and survives a reload — and so the **Export CSV link can carry the same
 *   filters**, which is the whole reason the filters live in the URL rather than in state;
 * - **history is per-kind.** A discrete change (a preset, a category, a page) `push`s so Back
 *   undoes it, per F5. The free-text box on the audit screen `replace`s, because one history
 *   entry per keystroke takes six presses of Back to undo "dune";
 * - **changing a filter resets the page.** Changing the date range while on page 4 and keeping
 *   page 4 shows an empty table and a page count that no longer means anything.
 *
 * **No debounced search box here.** Reports are filtered by dates and categories, not by
 * keywords; the one free-text input (the audit summary search) is debounced by the component that
 * owns it, which is the same split `use-book-filters.ts` uses.
 */
export function useReportFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const dir: "asc" | "desc" = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

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

      // Any filter change invalidates the current page number, unless the caller is the pager
      // itself — which passes `resetPage: false` precisely because it *is* the page change.
      if (options.resetPage !== false) params.delete("page");

      const serialised = params.toString();
      const href = serialised ? `${pathname}?${serialised}` : pathname;
      const navigate = options.history === "replace" ? router.replace : router.push;
      navigate(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setPage = React.useCallback(
    (next: number) => commit({ page: next > 1 ? next : undefined }, { resetPage: false }),
    [commit],
  );

  const reset = React.useCallback(() => {
    commit({ from: undefined, to: undefined, categoryId: undefined, sort: undefined, dir: undefined });
  }, [commit]);

  /** Filters only — the shape the CSV link needs, with no paging. */
  const exportFilters = React.useMemo(
    () => ({ from: from || undefined, to: to || undefined, categoryId: categoryId || undefined }),
    [from, to, categoryId],
  );

  return {
    from,
    to,
    categoryId,
    sort,
    dir,
    page,
    setPage,
    set: commit,
    reset,
    exportFilters,
    activeCount: [from, to, categoryId, sort].filter(Boolean).length,
  };
}

export type ReportFiltersState = ReturnType<typeof useReportFilters>;

/**
 * URL-synced state for the audit screen.
 *
 * **Separate from `useReportFilters` on purpose.** The audit log filters by actor and action,
 * not by category, and shares nothing with a report except `from`/`to`. Merging them would mean
 * one hook with two optional halves and a `type` discriminant nobody reads at the call site.
 */
export function useAuditFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const actor = searchParams.get("actor") ?? "";
  const action = searchParams.get("action") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const debounceTimer = React.useRef<number | undefined>(undefined);
  const [draft, setDraftState] = React.useState(q);
  const [editing, setEditing] = React.useState(false);

  // Render-phase sync (React's documented "adjusting state when props change" pattern), NOT an
  // effect: an effect would paint the stale draft for one frame first. This is the Unit 08 bug,
  // still worth carrying forward as a rule.
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

  const reset = React.useCallback(() => {
    window.clearTimeout(debounceTimer.current);
    setDraftState("");
    commit({ q: undefined, actor: undefined, action: undefined, from: undefined, to: undefined });
  }, [commit]);

  return {
    q,
    draft,
    setDraft,
    setEditing,
    actor,
    action,
    from,
    to,
    page,
    setPage: (next: number) => commit({ page: next > 1 ? next : undefined }, { resetPage: false }),
    set: commit,
    reset,
    activeCount: [q, actor, action, from, to].filter(Boolean).length,
  };
}

export type AuditFiltersState = ReturnType<typeof useAuditFilters>;