"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { HandCoins, MoreHorizontal, Receipt, Search, TrendingDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/common/status-badge";
import { FineRow } from "@/components/features/fines/fine-row";
import { FineActionDialog } from "@/components/features/fines/fine-action-dialog";
import { finesApi, settingsApi, type FineListItem } from "@/lib/api-client";
import { formatCurrency, initials } from "@/lib/utils";
import { FINE_STATUSES, type FineStatus } from "@/lib/constants";

/**
 * The staff fine register (spec 13, F9).
 *
 * **Three figures up top, then the list.** Unpaid total is the number an admin is
 * chasing; collected and waived this month are what the desk achieved. All three come from
 * the server's `totals`, computed over the **whole** filter rather than the visible page —
 * summing twenty rows would under-report the money owed the moment the table had more than
 * one page of fines.
 *
 * **Actions live in a row menu, not two buttons per row.** Collect and Waive are both
 * destructive to the fine's state and both open a dialog, so a row of two buttons per line
 * turns a scannable table into a wall of controls. The destructive item is separated and
 * worded, never colour alone (`ui-context.md`).
 *
 * **Terminal states have no menu at all.** A paid or waived fine cannot be collected or
 * waived again, and offering a control that is guaranteed to fail is worse than showing
 * none — the row simply reports how it settled.
 */
export function FinesRegister() {
  const [status, setStatus] = React.useState<FineStatus | undefined>(undefined);
  const [term, setTerm] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState(false);

  const [action, setAction] = React.useState<"collect" | "waive" | null>(null);
  const [target, setTarget] = React.useState<FineListItem | null>(null);

  const { data: policy } = useSWR("/api/settings/public", () => settingsApi.public());

  const key = `/api/fines?limit=50${status ? `&status=${status}` : ""}${draft ? `&q=${encodeURIComponent(draft)}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    // No positional parameters: SWR passes the cache key as the first argument, so a
    // `(signal?: AbortSignal)` parameter would hand that string to `fetch`.
    const controller = new AbortController();
    return finesApi.list(
      { status, q: draft || undefined, limit: 50 },
      controller.signal,
    );
  });

  const fines = data?.data.items ?? [];
  const totals = data?.data.totals ?? { unpaidTotal: 0, collectedThisMonth: 0, waivedThisMonth: 0 };
  const symbol = policy?.currencySymbol;
  const totalRows = data?.meta?.total ?? 0;

  // Render-phase sync, the same rule `use-loan-filters.ts` uses: while the box has focus
  // the user owns the value; once focus leaves, the input wins. Doing it during render
  // rather than in an effect avoids painting the stale term for one frame.
  if (!editing && draft !== term) setDraft(term);

  // Debounced: one request per pause in typing, not one per keystroke. `replace`, so a
  // search does not fill the history stack — discrete tab changes still `push`.
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDraft(term), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  const openAction = (fine: FineListItem, next: "collect" | "waive") => {
    setTarget(fine);
    setAction(next);
  };

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Fines"
        description="Everything the library is owed, and what the desk has settled this month."
      />

      {/* ------------------------------- KPI strip ------------------------------ */}
      {/*
       * The three figures are money, so they are formatted as money. `StatCard` defaults to
       * `toLocaleString`, which renders 20 as "20" — correct for a count, wrong for an
       * amount of cash. The `format` callback is applied to the animated value, so the
       * symbol is present on every frame of the count-up rather than appearing at the end.
       */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Unpaid total"
          value={totals.unpaidTotal}
          format={(n) => formatCurrency(n, { fallbackSymbol: symbol })}
          icon={TrendingDown}
          tone={totals.unpaidTotal > 0 ? "danger" : "success"}
          hint={
            totals.unpaidTotal > 0
              ? "Owed across all unpaid fines"
              : "Nothing outstanding anywhere"
          }
        />
        <StatCard
          label="Collected this month"
          value={totals.collectedThisMonth}
          format={(n) => formatCurrency(n, { fallbackSymbol: symbol })}
          icon={Receipt}
          tone="success"
          hint="Payments taken at the desk"
        />
        <StatCard
          label="Waived this month"
          value={totals.waivedThisMonth}
          format={(n) => formatCurrency(n, { fallbackSymbol: symbol })}
          // `HandCoins`, not a second `Receipt`: three cards in a row with the same glyph
          // reads as one figure repeated rather than three different figures.
          icon={HandCoins}
          tone="warning"
          hint="Forgiven, with a recorded reason"
        />
      </div>

      {/* -------------------------------- Filters ------------------------------- */}
      <section aria-labelledby="fine-register-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="fine-register-heading"
            className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
          >
            Register
          </h2>
          <p aria-live="polite" className="text-small text-muted-foreground">
            {isLoading && !data ? "Loading…" : `${totalRows} ${totalRows === 1 ? "fine" : "fines"}`}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onFocus={() => setEditing(true)}
              onBlur={() => setEditing(false)}
              placeholder="Search a member or book…"
              aria-label="Search fines"
              className="pl-10"
            />
            {term ? (
              <button
                type="button"
                onClick={() => setTerm("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tabs value={status ?? "all"} onValueChange={(value) => setStatus(value === "all" ? undefined : (value as FineStatus))}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                {FINE_STATUSES.map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {(status || term) ? (
              <>
                <Badge variant="soft" className="gap-1.5">
                  {[status, term].filter(Boolean).length} filter
                  {[status, term].filter(Boolean).length === 1 ? "" : "s"} active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStatus(undefined);
                    setTerm("");
                  }}
                  className="text-muted-foreground"
                >
                  Reset
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {error && !data ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-small text-danger-ink">
              {error instanceof Error ? error.message : "Something went wrong."}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => void mutate()}>
              Try again
            </Button>
          </div>
        ) : isLoading && fines.length === 0 ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading fines">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
                <Skeleton className="h-14 w-9 shrink-0 rounded-sm" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : fines.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              icon={Receipt}
              title={status || term ? "No fines match" : "No fines yet"}
              description={
                status || term
                  ? "Nothing matches the current filters. Clear them to see everything."
                  : "Fines appear here automatically when a book is returned after its due date."
              }
              action={
                status || term ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStatus(undefined);
                      setTerm("");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* --------------------------- Desktop table --------------------------- */}
            <div className="hidden overflow-hidden rounded-lg border border-border bg-surface lg:block">
              <table className="w-full text-left">
                <thead className="bg-muted text-caption font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">Book</th>
                    <th scope="col" className="px-4 py-3">Member</th>
                    <th scope="col" className="px-4 py-3">Late by</th>
                    <th scope="col" className="px-4 py-3">Amount</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((fine) => (
                    <tr key={fine.id} className="border-t border-border transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/catalog/${fine.book.slug}`}
                          className="line-clamp-1 text-small font-medium text-foreground underline-offset-2 hover:underline"
                        >
                          {fine.book.title}
                        </Link>
                        {fine.reason ? (
                          <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">
                            Waived: {fine.reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6 shrink-0">
                            {fine.member.id && fine.member.name ? (
                              <AvatarFallback className="text-[10px]">
                                {initials(fine.member.name)}
                              </AvatarFallback>
                            ) : null}
                          </Avatar>
                          <div className="min-w-0">
                            <Link
                              href={`/staff/members/${fine.member.id}`}
                              className="block truncate text-small text-foreground underline-offset-2 hover:underline"
                            >
                              {fine.member.name}
                            </Link>
                            {fine.member.membershipId ? (
                              <span className="block font-mono text-caption text-muted-foreground">
                                {fine.member.membershipId}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-small whitespace-nowrap text-muted-foreground">
                        {fine.daysOverdue} {fine.daysOverdue === 1 ? "day" : "days"}
                      </td>
                      <td className="px-4 py-3 font-display text-body font-semibold tabular-nums text-foreground">
                        {formatCurrency(fine.amount, { fallbackSymbol: symbol })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={fine.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {fine.status === "unpaid" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for the fine on ${fine.book.title}`}
                                className="text-muted-foreground"
                              >
                                <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-48">
                              <DropdownMenuItem onSelect={() => openAction(fine, "collect")}>
                                Collect payment
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
                                onSelect={() => openAction(fine, "waive")}
                              >
                                Waive fine
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-caption text-muted-foreground">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---------------------------- Mobile cards ---------------------------- */}
            <ul className="space-y-3 lg:hidden">
              {fines.map((fine) => (
                <FineRow key={fine.id} fine={fine} policy={policy} showMember />
              ))}
            </ul>
          </>
        )}
      </section>

      <FineActionDialog
        open={action !== null}
        action={action}
        fine={target}
        policy={policy}
        onClose={() => {
          setAction(null);
          setTarget(null);
        }}
        onChanged={() => void mutate()}
      />
    </div>
  );
}