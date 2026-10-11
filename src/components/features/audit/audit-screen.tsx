"use client";

import * as React from "react";
import useSWR from "swr";
import { Search, ScrollText } from "lucide-react";
import { auditApi, toErrorMessage } from "@/lib/api-client";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/common/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuditFilters } from "@/hooks/use-report-filters";
import { DateRangeFilter } from "@/components/features/reports/date-range-filter";
import { AuditTable } from "@/components/features/audit/audit-table";

const PAGE_SIZE = 50;

/**
 * The audit register.
 *
 * **Client-fetched, and the filters live in the URL** for the same reason the reports do: this
 * screen is entirely about narrowing a list, so a filtered view that cannot be shared or
 * reloaded is a view that has to be rebuilt by hand.
 *
 * **The action filter offers only actions that exist.** `listAudit` returns `distinct("action")`
 * from the whole log, so the menu cannot offer a filter that returns nothing — a free-text box
 * here would be a box whose only possible values are typos.
 */
export function AuditScreen() {
  const filters = useAuditFilters();

  const query = {
    q: filters.q || undefined,
    action: filters.action || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page: filters.page,
    limit: PAGE_SIZE,
  };

  const key = `/api/audit?${new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
  ).toString()}`;

  const { data, error, isLoading, mutate } = useSWR(key, () => auditApi.list(query));

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Audit log"
        description="An immutable record of every consequential action. Entries are never edited or deleted, and they outlive the records they describe."
      />

      <Card className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem] sm:items-end">
          <div className="space-y-2">
            <label htmlFor="audit-q" className="text-small font-medium text-foreground">
              Search summaries
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <Input
                id="audit-q"
                type="search"
                value={filters.draft}
                onFocus={() => filters.setEditing(true)}
                onBlur={() => filters.setEditing(false)}
                onChange={(event) => filters.setDraft(event.target.value)}
                placeholder="Issued, archived, collected…"
                className="ps-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="audit-action" className="text-small font-medium text-foreground">
              Action
            </label>
            <Select
              value={filters.action || "all"}
              onValueChange={(value) => filters.set({ action: value === "all" ? undefined : value })}
            >
              <SelectTrigger id="audit-action">
                <SelectValue placeholder="Every action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Every action</SelectItem>
                {data?.actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DateRangeFilter from={filters.from} to={filters.to} onChange={(next) => filters.set(next)} />

        {filters.activeCount > 0 ? (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-caption text-muted-foreground" aria-live="polite">
              {filters.activeCount} {filters.activeCount === 1 ? "filter" : "filters"} applied
            </p>
            <Button variant="ghost" size="sm" onClick={filters.reset}>
              Reset
            </Button>
          </div>
        ) : null}
      </Card>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-24" aria-busy="true">
          <Spinner label="Loading the audit log" />
        </div>
      ) : error ? (
        <Card className="p-0">
          <EmptyState
            icon={ScrollText}
            title="The audit log could not be loaded"
            description={toErrorMessage(error)}
            action={<Button onClick={() => mutate()}>Try again</Button>}
          />
        </Card>
      ) : data ? (
        <>
          <AuditTable
            items={data.items}
            emptyState={
              <Card className="p-0">
                <EmptyState
                  icon={ScrollText}
                  title="No entries match"
                  description="Nothing in the log matches these filters. Widen the date range or clear the search."
                />
              </Card>
            }
          />

          <nav
            aria-label="Audit pagination"
            className="flex flex-col items-center gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between"
          >
            <p className="text-small text-muted-foreground">
              Page {data.page} of {data.totalPages} · {data.total.toLocaleString("en-US")}{" "}
              {data.total === 1 ? "entry" : "entries"}
            </p>
            {data.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => filters.setPage(data.page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => filters.setPage(data.page + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </nav>
        </>
      ) : null}
    </div>
  );
}