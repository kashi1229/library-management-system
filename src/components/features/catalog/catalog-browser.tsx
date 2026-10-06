"use client";

import * as React from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { RotateCcw, SearchX, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { BookCard } from "@/components/features/catalog/book-card";
import { BookListRow } from "@/components/features/catalog/book-list-row";
import { CatalogFilterPanel } from "@/components/features/catalog/catalog-filter-panel";
import {
  CatalogSearch,
  CatalogToolbar,
  type CatalogView,
} from "@/components/features/catalog/catalog-toolbar";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { catalogApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CatalogBook, CatalogFacets } from "@/types";

const PAGE_SIZE = 12;

/**
 * The public catalog browser (F5).
 *
 * Owns the URL-synced filters, the SWR fetch and the grid/list layout. The desktop
 * filter column and the mobile sheet render the *same* `CatalogFilterPanel`, so the
 * two hosts cannot drift.
 *
 * **The SWR key is never empty.** Keying on `searchParams.toString()` alone meant the
 * very first load of a page with no params issued no request at all and rendered a
 * confident "no books" over a full catalog — SWR treats an empty-string key as "do
 * not fetch". The `pathname?` prefix guarantees a truthy key.
 *
 * `keepPreviousData` is not used: showing stale results while the filter changes
 * reads as "the filter did nothing", which is worse than a brief skeleton.
 */
export function CatalogBrowser({ facets }: { facets: CatalogFacets }) {
  const filters = useCatalogFilters();
  const reduced = usePrefersReducedMotion();

  const [view, setView] = useLocalStorage<CatalogView>("catalog:view", "grid");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const key = `/catalog?${new URLSearchParams(searchKey(filters, PAGE_SIZE)).toString()}`;
  const { data, error, isLoading } = useSWR(key, (signal?: AbortSignal) =>
    catalogApi.list(
      {
        q: filters.q || undefined,
        category: filters.category || undefined,
        language: filters.language || undefined,
        availability: filters.availability === "available" ? "available" : undefined,
        yearFrom: filters.yearFrom,
        yearTo: filters.yearTo,
        sort: filters.sort,
        page: filters.page,
        limit: PAGE_SIZE,
      },
      signal,
    ),
  );

  const books = data?.data.items ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;

  // A page beyond the end (after deleting a filter on page 4) must not strand the
  // reader on an empty grid. Walk back to the last real page.
  const onLastPage = !isLoading && books.length === 0 && filters.page > 1;

  const panel = (
    <CatalogFilterPanel filters={filters} facets={facets} />
  );

  return (
    <div className="container-page space-y-6">
      <header className="space-y-4 pt-10 pb-2">
        <div className="space-y-2">
          <h1 className="text-h1 font-display font-semibold text-pretty text-foreground">
            The catalog
          </h1>
          <p className="max-w-2xl text-body text-pretty text-muted-foreground">
            Every book the library holds. Search by title, author or ISBN, or narrow by
            category and what is on the shelf today.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <CatalogSearch filters={filters} className="flex-1" />
          {/* The sheet is the mobile home of the filters; on desktop the column does
              the job, so the trigger is hidden there rather than duplicating it. */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="lg" className="lg:hidden">
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters
                {filters.activeCount > 0 ? (
                  <span className="ms-0.5 font-mono text-caption">({filters.activeCount})</span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-hidden p-0">
              <SheetHeader className="shrink-0 border-b border-border px-5 py-4">
                <SheetTitle className="font-display text-h3">Filters</SheetTitle>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                {panel}
              </div>
              <div className="shrink-0 border-t border-border px-5 py-3">
                <Button className="w-full" onClick={() => setSheetOpen(false)}>
                  Show {total} {total === 1 ? "result" : "results"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <CatalogToolbar
        filters={filters}
        total={total}
        loading={isLoading}
        view={view}
        onViewChange={setView}
        className="border-b border-border pb-3"
      />

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          {/* Sticky below the 64px header, and independently scrollable so a long
              filter list never makes the results unreachable. */}
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pe-2 pb-4">
            {panel}
          </div>
        </aside>

        <section aria-label="Catalog results" aria-busy={isLoading}>
          {error && !data ? (
            <EmptyState
              icon={SearchX}
              title="The catalog could not be reached"
              description={error instanceof Error ? error.message : "Please try again."}
              action={
                <Button onClick={() => window.location.reload()}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Try again
                </Button>
              }
            />
          ) : onLastPage ? (
            <EmptyState
              icon={SearchX}
              title="Nothing on this page"
              description="These filters have fewer results than the page you were on."
              action={<Button onClick={() => filters.set({ page: "1" }, { resetPage: false })}>Back to the first page</Button>}
            />
          ) : books.length === 0 && !isLoading ? (
            <EmptyState
              icon={SearchX}
              title="No books match your filters"
              description={
                filters.activeCount > 0
                  ? "Try a different search term, or widen the category and year range."
                  : "The catalog is empty for now. Staff are cataloguing."
              }
              action={
                filters.activeCount > 0 ? (
                  <Button variant="outline" onClick={filters.reset}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <motion.div
              key={`${view}-${key}`}
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: reduced ? 0 : 0.04 } } }}
              className={cn(
                view === "grid"
                  ? "grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  : "flex flex-col gap-3",
              )}
            >
              {books.map((book, index) =>
                view === "grid" ? (
                  <BookCard key={book._id} book={book} priority={index < PAGE_SIZE && index < 6} />
                ) : (
                  <BookListRow key={book._id} book={book} />
                ),
              )}
            </motion.div>
          )}

          {isLoading && !books.length ? <CatalogSkeleton view={view} /> : null}

          {totalPages > 1 ? (
            <nav aria-label="Catalog pagination" className="mt-10 flex items-center justify-between border-t border-border pt-5">
              <p className="text-small text-muted-foreground">
                Page {meta?.page ?? 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(meta?.page ?? 1) <= 1}
                  onClick={() => filters.set({ page: String((meta?.page ?? 1) - 1) }, { resetPage: false })}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(meta?.page ?? 1) >= totalPages}
                  onClick={() => filters.set({ page: String((meta?.page ?? 1) + 1) }, { resetPage: false })}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}

/**
 * Build the SWR key from the filters.
 *
 * Separate from the fetch so the key and the request can never disagree about what
 * is being asked for — the exact bug Unit 08 shipped when the key was derived
 * separately from the query.
 */
function searchKey(filters: ReturnType<typeof useCatalogFilters>, limit: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.language) params.set("language", filters.language);
  if (filters.availability === "available") params.set("availability", "available");
  if (filters.yearFrom !== undefined) params.set("yearFrom", String(filters.yearFrom));
  if (filters.yearTo !== undefined) params.set("yearTo", String(filters.yearTo));
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("limit", String(limit));
  return params;
}

/** Skeletons that mirror the final layout, so nothing jumps when data lands. */
function CatalogSkeleton({ view }: { view: CatalogView }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        view === "grid"
          ? "mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
          : "mt-4 flex flex-col gap-3",
      )}
    >
      {Array.from({ length: view === "grid" ? 10 : 6 }, (_, index) =>
        view === "grid" ? (
          <div key={index} className="overflow-hidden rounded-lg border border-border bg-surface">
            <Skeleton className="aspect-[2/3] w-full rounded-none" />
            <div className="space-y-2 p-3.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ) : (
          <div key={index} className="flex gap-4 rounded-lg border border-border bg-surface p-4">
            <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export type { CatalogBook };