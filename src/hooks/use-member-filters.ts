"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { USER_STATUSES, type UserStatus } from "@/lib/constants";

/**
 * URL-synced filter state for the members table (spec 10).
 *
 * The URL is the source of truth for `q`, `status` and `page`, so a filtered list is
 * shareable and survives a reload.
 *
 * The search/debounce reconciliation follows the rule established in Unit 08 and
 * documented on `useBookFilters`: **focus is the signal for who owns the value.**
 * Copying the URL into the box whenever it moves fires for the hook's *own* debounced
 * write and eats whatever has been typed since, and it also fires on the render where
 * `useSearchParams` still reports the previous query. While the box has focus the user
 * owns it; once focus leaves, the URL wins.
 *
 * Discrete filter changes `push` so Back undoes them; the debounced search `replace`s,
 * because one history entry per keystroke would take six presses of Back to undo "dune".
 */

/** The members table has no status "all" value — absence of the param means all. */
function readStatus(raw: string | null): UserStatus | undefined {
  return raw && (USER_STATUSES as readonly string[]).includes(raw) ? (raw as UserStatus) : undefined;
}

export function useMemberFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = readStatus(searchParams.get("status"));
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);

  const debounceTimer = React.useRef<number | undefined>(undefined);

  const [draft, setDraftState] = React.useState(q);
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
    /** `undefined` means "All", which is also the unfiltered default. */
    status,
    page,
    activeCount: [q, status].filter(Boolean).length,
    set: commit,
    reset,
  };
}

export type MemberFilters = ReturnType<typeof useMemberFilters>;