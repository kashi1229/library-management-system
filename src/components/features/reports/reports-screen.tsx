"use client";

import * as React from "react";
import useSWR from "swr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlarmClock,
  Boxes,
  Flame,
  History,
  Receipt,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES, type ReportType } from "@/lib/constants";
import { categoriesApi, reportsApi, toErrorMessage } from "@/lib/api-client";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/common/spinner";
import { useReportFilters } from "@/hooks/use-report-filters";
import { DateRangeFilter } from "@/components/features/reports/date-range-filter";
import { SummaryStrip } from "@/components/features/reports/summary-strip";
import { ReportTable } from "@/components/features/reports/report-table";
import { ExportActions } from "@/components/features/reports/export-actions";
import type { ReportResult } from "@/types";

/** One page of rows. A report is a register, not a feed — 25 keeps it readable and the export fast. */
const PAGE_SIZE = 25;

/**
 * The six reports, with the icons the spec names.
 *
 * **Declared beside the shell rather than in `lib/constants.ts`**, because `constants.ts` holds
 * data with no JSX by design (it is imported by Server Components). This file is already a Client
 * Component, so the icons belong here — the same reason `lib/icons.ts` exists for the nav.
 */
export const REPORT_DEFS: ReadonlyArray<{
  type: ReportType;
  label: string;
  icon: LucideIcon;
  blurb: string;
  /** Whether this report is about books, and therefore has a category to filter by. */
  hasCategory: boolean;
}> = [
  { type: "borrowing", label: "Borrowing history", icon: History, blurb: "Every loan issued in the period.", hasCategory: true },
  { type: "overdue", label: "Overdue loans", icon: AlarmClock, blurb: "Active loans past their due date.", hasCategory: true },
  { type: "popular", label: "Popular books", icon: Flame, blurb: "Titles ranked by how often they went out.", hasCategory: true },
  { type: "members", label: "Member activity", icon: Users, blurb: "Members ranked by borrowing.", hasCategory: true },
  { type: "fines", label: "Fines", icon: Receipt, blurb: "Fines raised and how each was settled.", hasCategory: true },
  { type: "inventory", label: "Inventory", icon: Boxes, blurb: "Copies on the shelf, out, and held.", hasCategory: true },
];

/** The six reports as a sidebar on desktop and a horizontal scroller on mobile, per the spec. */
export function ReportNav({ active }: { active: ReportType }) {
  return (
    <nav aria-label="Reports">
      {/*
       * **A scroller on mobile, a grid from `sm`.** Six items wrap into a three-line block at
       * 360px and push the table below the fold; one scrollable row keeps the current report
       * visible and the other five one flick away.
       */}
      <ul className="-mx-4 flex snap-x snap-proximity gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {REPORT_DEFS.map(({ type, label, icon: Icon, blurb }) => {
          const current = type === active;
          return (
            <li key={type} className="w-[15rem] shrink-0 snap-start sm:w-auto">
              <Link
                href={`${ROUTES.staff.reports}/${type}`}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-full items-start gap-3 rounded-lg border p-3 transition-colors",
                  current
                    ? "border-primary/40 bg-primary-soft"
                    : "border-border bg-surface hover:border-primary/30 hover:bg-muted",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md",
                    current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-small font-medium",
                      current ? "text-primary" : "text-foreground",
                    )}
                  >
                    {label}
                  </span>
                  <span className="mt-0.5 block text-caption text-muted-foreground">{blurb}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The reports screen.
 *
 * **Client-fetched rather than server-rendered**, unlike the Unit 17 dashboards. A report is
 * interactive: the date range, the category and the sort all live in the URL and each refetches,
 * and a Server Component would re-render the whole page to change a sort column. The cost is one
 * extra request on first paint, which is why the loading state reserves the same space the
 * report will fill rather than collapsing into it.
 *
 * **`activeCount` is shown, because a filtered table that does not say so reads as an empty
 * one** — the rule already written down for the books toolbar.
 */
export function ReportsScreen({ initialType }: { initialType: ReportType }) {
  const filters = useReportFilters();
  const pathname = usePathname();
  const type = reportTypeFromPath(pathname) ?? initialType;
  const definition = REPORT_DEFS.find((def) => def.type === type) ?? REPORT_DEFS[0];

  const query = {
    from: filters.from || undefined,
    to: filters.to || undefined,
    categoryId: filters.categoryId || undefined,
    sort: filters.sort || undefined,
    dir: filters.dir,
    page: filters.page,
    limit: PAGE_SIZE,
  };

  // **Never an empty key** — an empty SWR key means "do not fetch", which would render a
  // permanently loading screen rather than an error.
  const key = `/api/reports/${type}?${new URLSearchParams(
    Object.entries(query).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])),
  ).toString()}`;

  const { data, error, isLoading, mutate } = useSWR(key, () => reportsApi.get(type, query));

  // Categories are fetched once per screen rather than per report, because the filter rail is
  // shared and the list is small and effectively static.
  const { data: categories } = useSWR("/api/categories", () => categoriesApi.list());

  function toggleSort(columnKey: string) {
    // Clicking the active column flips it; a new column starts descending, which is what
    // "show me the biggest" means for every numeric column on every one of these six reports.
    const same = filters.sort === columnKey;
    filters.set({ sort: columnKey, dir: same && filters.dir === "desc" ? "asc" : "desc" });
  }

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title={definition.label}
        description={definition.blurb}
        action={<ExportActions type={type} filters={filters.exportFilters} />}
      />

      <ReportNav active={type} />

      <div className="grid gap-6 lg:grid-cols-[19rem_1fr] lg:items-start">
        {/* **The filter rail is sticky on desktop and stacks above the table on mobile.** Sticky
            because a filter you have to scroll back up to change is a filter nobody changes, and
            a report with nine columns has the filters out of sight after two rows. */}
        <Card className="space-y-5 p-5 lg:sticky lg:top-24 print:hidden">
          <div className="space-y-2">
            <h2 className="text-small font-medium text-foreground">Date range</h2>
            <DateRangeFilter from={filters.from} to={filters.to} onChange={(next) => filters.set(next)} />
          </div>

          {definition.hasCategory ? (
            <div className="space-y-2">
              <label htmlFor="report-category" className="text-small font-medium text-foreground">
                Category
              </label>
              <Select
                value={filters.categoryId || "all"}
                onValueChange={(value) =>
                  filters.set({ categoryId: value === "all" ? undefined : value })
                }
              >
                <SelectTrigger id="report-category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category._id} value={category._id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

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

        <div className="space-y-5">
          {isLoading && !data ? (
            <div className="flex items-center justify-center py-24" aria-busy="true">
              <Spinner label="Building the report" />
            </div>
          ) : error ? (
            <Card className="p-0">
              <EmptyState
                icon={AlarmClock}
                title="This report could not be built"
                description={toErrorMessage(error)}
                action={<Button onClick={() => mutate()}>Try again</Button>}
              />
            </Card>
          ) : data ? (
            <ReportBody
              data={data}
              sort={filters.sort}
              dir={filters.dir as "asc" | "desc"}
              onSort={toggleSort}
              onPage={filters.setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The summary, the table and the pager — split out so the fetch wrapper stays readable. */
function ReportBody({
  data,
  sort,
  dir,
  onSort,
  onPage,
}: {
  data: ReportResult;
  sort: string;
  dir: "asc" | "desc";
  onSort: (key: string) => void;
  onPage: (page: number) => void;
}) {
  return (
    <>
      <SummaryStrip items={data.summary} />

      <ReportTable
        columns={data.columns}
        rows={data.rows}
        sort={sort}
        dir={dir}
        onSort={onSort}
        emptyState={
          <Card className="p-0">
            <EmptyState
              icon={History}
              title="Nothing in this period"
              description="No rows match the current filters. Widen the date range or clear the category to see more."
            />
          </Card>
        }
      />

      {/*
       * **Always rendered, even on page 1 of 1.** A report says "of 412" whether or not there is a
       * pager, so the reader knows how much they are not looking at — the "a capped list must say
       * it is capped" rule from Unit 14. The *buttons* only appear when there is somewhere to go,
       * because a disabled "Previous" on page 1 of 1 is a control that cannot work.
       */}
      <nav
        aria-label="Report pagination"
        className="flex flex-col items-center gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between print:hidden"
      >
        <p className="text-small text-muted-foreground">
          Page {data.page} of {data.totalPages} · {data.total.toLocaleString("en-US")}{" "}
          {data.total === 1 ? "row" : "rows"}
        </p>
        {data.totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => onPage(data.page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </nav>
    </>
  );
}

/** `/staff/reports/overdue` → `overdue`; a bare `/staff/reports` → `null`. */
function reportTypeFromPath(pathname: string): ReportType | null {
  const tail = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return REPORT_DEFS.find((def) => def.type === tail)?.type ?? null;
}