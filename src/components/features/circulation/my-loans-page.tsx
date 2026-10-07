"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { BookMarked, Library, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import {
  MyLoanCard,
  MyLoanHistoryRow,
  MyLoansSkeleton,
} from "@/components/features/circulation/my-loans";
import { loansApi, settingsApi } from "@/lib/api-client";

/**
 * The member's own loans (spec 12).
 *
 * **`/api/loans/mine` takes no member id** — it is resolved from the session (invariant 3),
 * so there is nothing on this page that could reach another member's loans, and no query
 * param to get wrong.
 *
 * Two tabs, not four. A member has no use for "due soon" and "overdue" as separate views:
 * both are simply *late*, and both are already called out by the countdown ring and the
 * overdue ribbon on the card. Four tabs would be a librarian's taxonomy imposed on
 * somebody who just wants to know what to return first.
 *
 * **Both lists fetch from the same key prefix but different `status` values**, so switching
 * tabs is instant from cache rather than a spinner.
 */
export function MyLoans() {
  const [tab, setTab] = React.useState<"active" | "returned">("active");

  // Public endpoint: the ring needs `loanPeriodDays` to know how full to draw itself, and a
  // member must not need a staff session to see their own loan period.
  const { data: policy } = useSWR("/api/settings/public", () => settingsApi.public());

  const key = `/api/loans/mine?status=${tab}&limit=50`;

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    // No positional parameters: SWR passes the **cache key** as the first argument, so a
    // `(signal?: AbortSignal)` parameter would hand that string to `fetch` and throw.
    const controller = new AbortController();
    return loansApi.mine({ status: tab, limit: 50 }, controller.signal);
  });

  const loans = data?.data.items ?? [];

  const refresh = React.useCallback(() => {
    void mutate();
  }, [mutate]);

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="My loans"
        description="What you have out, when it is due, and what you can still renew."
        action={
          <Button variant="outline" asChild>
            <Link href="/catalog">
              <Library className="size-4" strokeWidth={1.75} aria-hidden="true" />
              Browse catalog
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as "active" | "returned")}>
        <TabsList>
          <TabsTrigger value="active">
            <BookMarked className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Current
          </TabsTrigger>
          <TabsTrigger value="returned">History</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {isLoading && loans.length === 0 ? (
            <MyLoansSkeleton />
          ) : error && loans.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-6 text-center">
              <p className="text-small text-danger-ink">
                {error instanceof Error ? error.message : "Something went wrong."}
              </p>
              <Button variant="outline" className="mt-3" onClick={refresh}>
                Try again
              </Button>
            </div>
          ) : loans.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                icon={BookMarked}
                title="Nothing borrowed right now"
                description="When you borrow a book it appears here with a countdown to its due date."
                action={
                  <Button asChild>
                    <Link href="/catalog">
                      <Search className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      Find something to read
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {loans.map((loan) => (
                <MyLoanCard key={loan.id} loan={loan} policy={policy} onRenewed={refresh} />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="returned">
          {isLoading && loans.length === 0 ? (
            <MyLoansSkeleton count={4} />
          ) : loans.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface">
              <EmptyState
                icon={BookMarked}
                title="No history yet"
                description="Books you have returned are listed here, so you can find one to review or borrow again."
                action={
                  <Button asChild>
                    <Link href="/catalog">Browse catalog</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className="space-y-3">
              {loans.map((loan) => (
                <MyLoanHistoryRow key={loan.id} loan={loan} />
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}