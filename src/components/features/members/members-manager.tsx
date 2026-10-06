"use client";

import * as React from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Search, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { MembersTable } from "@/components/features/members/members-table";
import type { MemberRowActions } from "@/components/features/members/member-row-actions";
import { SuspendDialog } from "@/components/features/members/suspend-dialog";
import { ResetPasswordDialog } from "@/components/features/members/reset-password-dialog";
import { useMemberFilters } from "@/hooks/use-member-filters";
import { membersApi, type MemberListFilters, type MemberSummary } from "@/lib/api-client";

const PAGE_SIZE = 20;

/**
 * Staff member management (spec 10).
 *
 * Filter state lives in the URL and the fetch is SWR-keyed on it, so a filtered list is
 * shareable and the back button works. Discrete filters `push`, the debounced search
 * `replace`s — see `useMemberFilters`.
 *
 * **The SWR key is prefixed with the pathname and the fetcher takes no parameters.**
 * Both were learned the hard way in Units 08 and 09: an empty-string key means "do not
 * fetch", and SWR calls `fetcher(key)`, so a fetcher declared `(signal?: AbortSignal)`
 * receives the *string key* and hands it to `fetch`, which throws. Together they
 * produced a confident "0 members" over a full database.
 */
export function MembersManager() {
  const router = useRouter();
  const filters = useMemberFilters();

  const [suspending, setSuspending] = React.useState<MemberSummary | null>(null);
  const [resetting, setResetting] = React.useState<MemberSummary | null>(null);
  const [activating, setActivating] = React.useState<string | null>(null);

  const query = React.useMemo<MemberListFilters>(
    () => ({
      q: filters.q || undefined,
      status: filters.status,
      page: filters.page,
      limit: PAGE_SIZE,
    }),
    [filters.q, filters.status, filters.page],
  );

  const key = `/staff/members?${new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
  ).toString()}`;

  const { data, error, isLoading, mutate } = useSWRMembers(key, query);

  const members = data?.data.items ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;

  const reinstate = async (member: MemberSummary) => {
    setActivating(member.id);
    try {
      const updated = await membersApi.activate(member.id);
      toast.success(`${updated.name} can borrow again`, {
        description: "Their suspension reason has been cleared.",
      });
      void mutate();
    } catch {
      toast.error("Could not reinstate this member", { description: "Please try again." });
    } finally {
      setActivating(null);
    }
  };

  const actions: MemberRowActions = {
    onSuspend: setSuspending,
    onActivate: (member) => void reinstate(member),
    onResetPassword: setResetting,
  };

  const goToPage = (next: number) => {
    filters.set({ page: String(next) }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Members"
        description="Search the register, review a member's record, and suspend or reinstate access."
        action={
          <Button variant="outline" onClick={() => router.push("/staff/circulation")}>
            Go to circulation desk
          </Button>
        }
      />

      {/* ------------------------------- Toolbar ------------------------------- */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              value={filters.draft}
              onChange={(event) => filters.setDraft(event.target.value)}
              onFocus={() => filters.setEditing(true)}
              onBlur={() => filters.setEditing(false)}
              placeholder="Search name, email or membership ID…"
              aria-label="Search members"
              className="pl-10"
            />
            {filters.draft ? (
              <button
                type="button"
                onClick={() => filters.setDraft("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={filters.status ?? "all"}
            onValueChange={(value) =>
              filters.set({ status: value === "all" ? undefined : value })
            }
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
            </TabsList>
          </Tabs>

          {filters.activeCount > 0 ? (
            <>
              <Badge variant="soft" className="gap-1.5">
                {filters.activeCount} {filters.activeCount === 1 ? "filter" : "filters"} active
              </Badge>
              <Button variant="ghost" size="sm" onClick={filters.reset} className="text-muted-foreground">
                Reset
              </Button>
            </>
          ) : null}

          <p aria-live="polite" className="ms-auto text-small text-muted-foreground">
            {isLoading && !data ? "Loading…" : `${total} ${total === 1 ? "member" : "members"}`}
          </p>
        </div>
      </div>

      {/* -------------------------------- Results -------------------------------- */}
      {error && !data ? (
        <EmptyState
          icon={UserX}
          title="The member register could not be loaded"
          description={error instanceof Error ? error.message : "Something went wrong."}
          action={<Button onClick={() => void mutate()}>Try again</Button>}
        />
      ) : (
        <>
          <MembersTable
            members={members}
            actions={actions}
            emptyState={
              isLoading ? (
                <MembersSkeleton />
              ) : (
                <div className="rounded-lg border border-border bg-surface">
                  <EmptyState
                    icon={UserX}
                    title={
                      filters.activeCount > 0 ? "No members match" : "No members registered yet"
                    }
                    description={
                      filters.activeCount > 0
                        ? "Try a different name, email or membership ID."
                        : "Members appear here as soon as they register."
                    }
                    action={
                      filters.activeCount > 0 ? (
                        <Button variant="outline" onClick={filters.reset}>
                          Clear filters
                        </Button>
                      ) : undefined
                    }
                  />
                </div>
              )
            }
          />

          {totalPages > 1 ? (
            <nav
              aria-label="Members pagination"
              className="flex flex-col items-center gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between"
            >
              <p className="text-small text-muted-foreground">
                Page {meta?.page ?? 1} of {totalPages} · {total} in total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(meta?.page ?? 1) <= 1 || activating !== null}
                  onClick={() => goToPage((meta?.page ?? 1) - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(meta?.page ?? 1) >= totalPages || activating !== null}
                  onClick={() => goToPage((meta?.page ?? 1) + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      <SuspendDialog
        open={suspending !== null}
        onOpenChange={(open) => {
          if (!open) setSuspending(null);
        }}
        member={suspending}
        onSuspended={() => void mutate()}
      />

      <ResetPasswordDialog
        open={resetting !== null}
        onOpenChange={(open) => {
          if (!open) setResetting(null);
        }}
        member={resetting}
      />
    </div>
  );
}

/**
 * Fetch one page of members.
 *
 * The fetcher takes **no parameters**: SWR passes the cache key as the first argument,
 * so a `(signal?: AbortSignal)` parameter receives a string and `fetch` rejects it with
 * *"Failed to convert value to 'AbortSignal'"*. Cancellation is wired by hand, and the
 * superseded request is aborted rather than left to race the new one.
 */
function useSWRMembers(key: string, query: MemberListFilters) {
  const controllerRef = React.useRef<AbortController | null>(null);

  return useSWR(key, async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      return await membersApi.list(query, controller.signal);
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  });
}

/** Skeletons mirroring the table's row shape, so nothing jumps when data lands. */
function MembersSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading members">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-24 sm:block" />
          <Skeleton className="hidden h-5 w-16 sm:block" />
        </div>
      ))}
    </div>
  );
}