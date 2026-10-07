"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOAN_VIEWS, type LoanView } from "@/lib/constants";

/**
 * URL-synced filter state for the circulation desk (spec 12).
 *
 * Identical rules to `use-member-filters.ts`, on purpose:
 *
 * - **the URL is the source of truth** for `q` and `status`, so a filtered desk is
 *   shareable and survives a reload;
 * - **focus owns the search box.** While the box has focus the user owns the value and the
 *   debounce only moves the URL; once focus leaves, the URL wins. Copying the URL into the
 *   box whenever it moves fires for the hook's *own* debounced write and eats whatever has
 *   been typed since — the Unit 08 bug, still worth carrying forward as a rule;
 * - **discrete changes `push`, the debounced search `replace`s.** One history entry per
 *   keystroke would take six presses of Back to undo "dune".
 *
 * `memberId` and `bookId` also live here, because the Unit 10 member page opens the desk
 * with the member already selected — that has to survive a reload, or the link loses its
 * one piece of context.
 */

/** The desk's four tabs map onto the derived loan views. */
export const DESK_TABS = [
  { value: "active", label: "Active loans" },
  { value: "due_soon", label: "Due soon" },
  { value: "overdue", label: "Overdue" },
  { value: "returned", label: "Returned" },
] as const satisfies ReadonlyArray<{ value: LoanView; label: string }>;

function readView(raw: string | null): LoanView | undefined {
  return raw && (LOAN_VIEWS as readonly string[]).includes(raw) ? (raw as LoanView) : undefined;
}

export function useLoanFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = readView(searchParams.get("status")) ?? "active";
  const memberId = searchParams.get("memberId") ?? "";
  const bookId = searchParams.get("bookId") ?? "";

  const debounceTimer = React.useRef<number | undefined>(undefined);

  const [draft, setDraftState] = React.useState(q);
  const [editing, setEditing] = React.useState(false);

  // Render-phase sync (React's documented "adjusting state when props change" pattern),
  // NOT an effect: an effect would paint the stale draft for one frame first.
  if (!editing && draft !== q) setDraftState(q);

  const commit = React.useCallback(
    (
      next: Record<string, string | undefined>,
      options: { history?: "push" | "replace" } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }

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
    commit({ q: undefined, status: undefined }, { history: "push" });
  }, [commit]);

  return {
    q,
    draft,
    setDraft,
    setEditing,
    status,
    /** Preselected member from a deep link (the Unit 10 member page). */
    memberId,
    /** Preselected book, also linkable. */
    bookId,
    activeCount: [q, status !== "active" ? status : null].filter(Boolean).length,
    set: commit,
    reset,
  };
}

export type LoanFilters = ReturnType<typeof useLoanFilters>;

/** Pathname-prefixed SWR key. **Never empty** — an empty key means "do not fetch". */
export function useLoansKey(filters: {
  q: string;
  status: LoanView;
  memberId?: string;
  bookId?: string;
  page?: number;
  limit?: number;
}): string {
  const pathname = usePathname();
  const query = new URLSearchParams({
    status: filters.status,
    limit: String(filters.limit ?? 20),
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.memberId ? { memberId: filters.memberId } : {}),
    ...(filters.bookId ? { bookId: filters.bookId } : {}),
    ...(filters.page && filters.page > 1 ? { page: String(filters.page) } : {}),
  });

  return `${pathname}?${query.toString()}`;
}