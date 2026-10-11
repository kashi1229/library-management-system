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

/** The six reports as a tab bar on desktop and a clean horizontal pill scroller on mobile. */
export function ReportNav({ active }: { active: ReportType }) {
  return (
    <nav aria-label="Reports Directory" className="print:hidden">
      {/*
       * Scroller on mobile, clean responsive grid from sm up.
       * Active item has parchment & ink accent styling with tactile indicator.
       */}
      <div className="-mx-4 flex snap-x snap-proximity gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3 xl:grid-cols-6">
        {REPORT_DEFS.map(({ type, label, icon: Icon, blurb }) => {
          const current = type === active;
          return (
            <Link
              key={type}
              href={`${ROUTES.staff.reports}/${type}`}
              aria-current={current ? "page" : undefined}
              className={cn(
                "group relative flex w-[14.5rem] shrink-0 snap-start flex-col justify-between rounded-xl border p-3.5 transition-all duration-200 sm:w-auto",
                current
                  ? "border-primary/50 bg-primary-soft/50 shadow-xs ring-1 ring-primary/20"
                  : "border-border/80 bg-surface hover:border-primary/30 hover:bg-muted/40 hover:shadow-2xs",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg transition-colors",
                    current
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.85} />
                </span>
                <div className="min-w-0">
                  <span
                    className={cn(
                      "block text-small font-semibold tracking-tight",
                      current ? "text-primary font-bold" : "text-foreground group-hover:text-primary",
                    )}
                  >
                    {label}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-caption text-muted-foreground leading-snug">
                    {blurb}
                  </span>
                </div>
              </div>

              {current && (
                <span
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </div>
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
    <div className="container-page space-y-6 pb-12">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={definition.label}
          description={definition.blurb}
          action={<ExportActions type={type} filters={filters.exportFilters} />}
          className="w-full"
        />
      </div>

      <ReportNav active={type} />

      <div className="grid gap-6 lg:grid-cols-[18.5rem_1fr] lg:items-start">
        {/*
         * Filter rail: sticky on desktop with rounded card and clear sections
         */}
        <Card className="overflow-hidden rounded-xl border border-border/80 bg-surface p-5 shadow-xs lg:sticky lg:top-20 print:hidden">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="text-small font-semibold tracking-tight text-foreground">
              Filter report
            </h2>
            {filters.activeCount > 0 ? (
              <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-caption font-semibold text-accent-ink">
                {filters.activeCount} active
              </span>
            ) : null}
          </div>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="block text-caption font-semibold text-foreground uppercase tracking-wider">
                Date range
              </label>
              <DateRangeFilter from={filters.from} to={filters.to} onChange={(next) => filters.set(next)} />
            </div>

            {definition.hasCategory ? (
              <div className="space-y-2 border-t border-border/60 pt-4">
                <label htmlFor="report-category" className="block text-caption font-semibold text-foreground uppercase tracking-wider">
                  Book category
                </label>
                <Select
                  value={filters.categoryId || "all"}
                  onValueChange={(value) =>
                    filters.set({ categoryId: value === "all" ? undefined : value })
                  }
                >
                  <SelectTrigger id="report-category" className="h-9 w-full bg-surface text-caption">
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
              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <p className="text-caption text-muted-foreground" aria-live="polite">
                  {filters.activeCount} {filters.activeCount === 1 ? "filter" : "filters"} applied
                </p>
                <Button variant="ghost" size="sm" onClick={filters.reset} className="h-8 text-caption text-muted-foreground hover:text-foreground">
                  Reset filters
                </Button>
              </div>
            ) : null}
          </div>
        </Card>

        {/* Report main body */}
        <div className="min-w-0 space-y-6">
          {isLoading && !data ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 py-24" aria-busy="true">
              <Spinner label="Building the report" />
              <p className="mt-3 text-caption text-muted-foreground">Aggregating records and compiling metrics…</p>
            </div>
          ) : error ? (
            <Card className="rounded-xl border border-danger/30 p-2 shadow-xs">
              <EmptyState
                icon={AlarmClock}
                title="This report could not be built"
                description={toErrorMessage(error)}
                action={<Button onClick={() => mutate()} className="h-9">Try again</Button>}
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
    <div className="space-y-6">
      <SummaryStrip items={data.summary} />

      <ReportTable
        columns={data.columns}
        rows={data.rows}
        sort={sort}
        dir={dir}
        onSort={onSort}
        emptyState={
          <Card className="rounded-xl border border-dashed border-border p-4 shadow-none">
            <EmptyState
              icon={History}
              title="Nothing in this period"
              description="No rows match the current filters. Widen the date range or clear the category to see more."
            />
          </Card>
        }
      />

      {/*
       * Clean pagination footer with row counts and disabled state awareness
       */}
      <nav
        aria-label="Report pagination"
        className="flex flex-col items-center gap-3 rounded-xl border border-border/70 bg-surface px-4 py-3.5 shadow-2xs sm:flex-row sm:justify-between print:hidden"
      >
        <p className="text-small font-medium text-muted-foreground">
          Page <span className="font-semibold text-foreground">{data.page}</span> of{" "}
          <span className="font-semibold text-foreground">{data.totalPages}</span>{" "}
          <span className="mx-1.5 text-border">•</span>{" "}
          <span className="tabular-nums font-semibold text-foreground">{data.total.toLocaleString("en-US")}</span>{" "}
          {data.total === 1 ? "row" : "rows"} total
        </p>
        {data.totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => onPage(data.page - 1)}
              className="h-8 px-3 text-caption font-medium shadow-2xs"
            >
              Previous
            </Button>
            <div className="text-caption font-medium text-muted-foreground px-1">
              {data.page} / {data.totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => onPage(data.page + 1)}
              className="h-8 px-3 text-caption font-medium shadow-2xs"
            >
              Next
            </Button>
          </div>
        ) : null}
      </nav>
    </div>
  );
}

/** `/staff/reports/overdue` → `overdue`; a bare `/staff/reports` → `null`. */
function reportTypeFromPath(pathname: string): ReportType | null {
  const tail = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return REPORT_DEFS.find((def) => def.type === tail)?.type ?? null;
}