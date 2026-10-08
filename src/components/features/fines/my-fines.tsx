"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { CheckCircle2, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { FineRow } from "@/components/features/fines/fine-row";
import { PageHeader } from "@/components/common/page-header";
import { finesApi, settingsApi } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";

/**
 * A member's own fines (spec 13, F9).
 *
 * **`GET /api/fines/mine` takes no member id** — it is resolved from the session
 * (invariant 3), so nothing on this page can reach another member's debt.
 *
 * The summary card leads with the **outstanding total**, and that number comes from the
 * server's `outstandingTotal`, not from adding up the visible rows. The list is paginated,
 * so a member with more than `limit` fines would otherwise be shown a smaller debt than
 * they actually owe — which on a page about owing money is the worst possible bug.
 *
 * Above the threshold nothing changes visually. `fineBlockThreshold` is deliberately **not**
 * in the public settings subset, so this page cannot pre-judge whether they are blocked;
 * the server says so, at the moment they try to borrow. Announcing it here would either be
 * wrong or leak policy the library may not publish.
 */
export function MyFines() {
  const [status, setStatus] = React.useState<"unpaid" | "paid" | "waived" | undefined>(undefined);

  // Public endpoint for the currency symbol only. No threshold is exposed here, and none
  // is wanted.
  const { data: policy } = useSWR("/api/settings/public", () => settingsApi.public());

  const key = `/api/fines/mine?limit=50${status ? `&status=${status}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    // No positional parameters: SWR passes the **cache key** as the first argument, so a
    // `(signal?: AbortSignal)` parameter would hand that string to `fetch`.
    const controller = new AbortController();
    return finesApi.mine({ status, limit: 50 }, controller.signal);
  });

  const fines = data?.data.items ?? [];
  const outstanding = data?.data.outstandingTotal ?? 0;
  const symbol = policy?.currencySymbol ?? "$";

  const totalRows = data?.meta?.total ?? 0;

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Fines"
        description="What you owe for late returns, and the history of everything already settled."
      />

      {/* ------------------------------ Summary ------------------------------ */}
      <section
        aria-label="Outstanding balance"
        className={cn(
          "rounded-lg border p-6 shadow-soft md:p-8",
          outstanding > 0
            ? "border-danger/35 bg-danger-soft"
            : "border-border bg-surface",
        )}
      >
        {isLoading && !data ? (
          <Skeleton className="h-20 w-full" />
        ) : outstanding > 0 ? (
          <>
            <p className="text-small font-medium text-danger-ink">
              Outstanding balance
            </p>
            <p className="mt-1 font-display text-h1 font-semibold tracking-[-0.03em] tabular-nums text-danger-ink">
              {formatCurrency(outstanding, { fallbackSymbol: symbol })}
            </p>
            <p className="mt-2 max-w-prose text-small text-danger-ink">
              Please settle this at the circulation desk. Once it is paid or waived you can
              borrow again straight away.
            </p>
          </>
        ) : (
          <>
            {/* All clear gets a positive moment. A fines page that only ever looks like a
                bill teaches members to dread opening it. */}
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-success-soft text-success-ink"
              >
                <CheckCircle2 className="size-6" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-small font-medium text-muted-foreground">
                  Outstanding balance
                </p>
                <p className="mt-0.5 font-display text-h2 font-semibold tracking-[-0.02em] text-foreground">
                  All clear
                </p>
                <p className="mt-1 text-small text-muted-foreground">
                  You have nothing outstanding. Nothing is stopping you borrowing today.
                </p>
              </div>
            </div>
          </>
        )}
      </section>

      {/* -------------------------------- List -------------------------------- */}
      <section aria-labelledby="fine-history-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="fine-history-heading"
            className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
          >
            {status ? `${status} fines` : "All fines"}
          </h2>

          <p aria-live="polite" className="text-small text-muted-foreground">
            {isLoading && !data ? "Loading…" : `${totalRows} ${totalRows === 1 ? "fine" : "fines"}`}
          </p>
        </div>

        <Tabs
          value={status ?? "all"}
          onValueChange={(value) => setStatus(value === "all" ? undefined : (value as typeof status))}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="waived">Waived</TabsTrigger>
          </TabsList>
        </Tabs>

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
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
              >
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
              title={status === "unpaid" ? "Nothing outstanding" : "No fines"}
              description={
                status === "unpaid"
                  ? "You have no unpaid fines. Keep it up."
                  : "Fines appear here when a book comes back after its due date."
              }
              action={
                <Button asChild>
                  <Link href="/my-loans">See my loans</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {fines.map((fine) => (
              <FineRow key={fine.id} fine={fine} policy={policy} showMember={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}