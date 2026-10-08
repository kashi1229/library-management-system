"use client";

import * as React from "react";
import { useMemo } from "react";
import useSWR from "swr";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { BooksTable } from "@/components/features/books/books-table";
import { BulkBar } from "@/components/features/books/bulk-bar";
import { ReservationQueueSheet } from "@/components/features/reservations/reservation-queue-sheet";
import { useBookFilters } from "@/hooks/use-book-filters";
import { booksApi, categoriesApi, type BookListFilters, type BookSummary } from "@/lib/api-client";
import { BOOK_SORTS, BOOK_SORT_LABELS } from "@/lib/constants";

/**
 * Staff book management (spec 08).
 *
 * **Filter state lives in the URL.** `q`, `category`, `status`, `sort` and `page`
 * are all search params, so a filtered view is shareable, survives a reload and
 * plays with the back button, which is what `project-overview.md` F5 asks for.
 *
 * Data loading is SWR keyed on the URL. That matters here: filtering is a
 * navigation, not a local mutation, so deriving the fetch key from the URL is
 * what makes the browser's back button and a shared link behave correctly — and
 * it means one effect owns one external system instead of three effects each
 * calling `setState` and cascading renders (which is exactly what the React
 * Compiler lint rules reject).
 */
const PAGE_SIZE = 20;

export function BooksManager() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useBookFilters();
  const [categories, setCategories] = React.useState<
    Awaited<ReturnType<typeof categoriesApi.list>>
  >([]);

  // Categories change rarely, so they load once and never revalidate per filter.
  React.useEffect(() => {
    let cancelled = false;
    categoriesApi
      .list()
      .then((items) => {
        if (!cancelled) setCategories(items);
      })
      .catch(() => {
        /* the filter simply shows "All categories" */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
 * SWR cache key: the pathname plus the serialised query.
 *
 * The `pathname?` prefix is not cosmetic. **SWR treats an empty-string key as
 * "do not fetch"**, so keying on `searchParams.toString()` alone meant the very
 * first load of `/staff/books` — which has no params — never issued a request at
 * all. The page rendered a confident "No books yet · 0 books" over a catalog with
 * 32 books in it, and no assertion in an API pass could have caught it. Including
 * the pathname guarantees the key is always truthy.
 *
 * Deriving the key from the URL also makes the browser's back button and a shared
 * link re-fetch the right page, and SWR abandons an in-flight request for an old
 * filter rather than letting it overwrite the new one.
 */
const key = `${pathname}?${searchParams.toString()}`;
  const query = React.useMemo(
    () => ({
      q: filters.q || undefined,
      category: filters.category || undefined,
      status: filters.status,
      sort: filters.sort,
      page: filters.page,
      limit: PAGE_SIZE,
    }),
    [filters.q, filters.category, filters.status, filters.sort, filters.page],
  );

  const { data, error, isLoading, mutate } = useSWRBooks(key, query);

  const books = useMemo(() => data?.data.items ?? [], [data]);
  const meta = data?.meta;
  const total = meta?.total ?? books.length;
  const totalPages = meta?.totalPages ?? 1;
  const page = meta?.page ?? filters.page;

  // The selection belongs to one page of results. Deriving it from a key that
  // changes with the filters means it resets *during* render, which is the
  // supported alternative to an effect and avoids a frame of stale selection.
  const selectionKey = `${key}|${books.map((book) => book._id).join(",")}`;
  const [selection, setSelection] = React.useState<{ key: string; ids: Set<string> }>({
    key: selectionKey,
    ids: new Set(),
  });
  const selected = selection.key === selectionKey ? selection.ids : EMPTY_SET;

  const setSelectedIds = React.useCallback(
    (ids: Set<string>) => setSelection({ key: selectionKey, ids }),
    [selectionKey],
  );

  const toggle = React.useCallback(
    (id: string) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
    },
    [selected, setSelectedIds],
  );

  const toggleAll = React.useCallback(() => {
    const ids = books.map((book) => book._id);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(ids));
  }, [books, selected, setSelectedIds]);

  const [archiving, setArchiving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<BookSummary | null>(null);

  /**
   * Which book's queue the sheet is showing (Unit 14).
   *
   * The row menu only knows the book, so the sheet is opened from here rather than from the
   * menu — one piece of state owns "which sheet is open", which is the same reason
   * `ConfirmDialog` is driven by the record it is about instead of a boolean.
   */
  const [queueBook, setQueueBook] = React.useState<BookSummary | null>(null);

  const toggleArchive = React.useCallback(
    async (book: BookSummary) => {
      const archived = book.status !== "archived";
      try {
        await booksApi.setArchived(book._id, archived);
        toast.success(archived ? "Book archived" : "Book restored", {
          description: `“${book.title}” is ${
            archived ? "hidden from the public catalog" : "back in the catalog"
          }.`,
        });
        // Re-read rather than guess: archiving on the Active tab should make the
        // row disappear, and archiving on All should keep it.
        void mutate();
      } catch (err) {
        toast.error(archived ? "Could not archive this book" : "Could not restore this book", {
          description: err instanceof Error ? err.message : "Please try again.",
        });
      }
    },
    [mutate],
  );

  const archiveSelected = React.useCallback(async () => {
    const ids = [...selected];
    if (ids.length === 0) return;

    setArchiving(true);
    try {
      const result = await booksApi.bulkArchive(ids);
      toast.success(`${result.archived} ${result.archived === 1 ? "book" : "books"} archived`, {
        description:
          result.skipped > 0
            ? `${result.skipped} were already archived.`
            : "They are hidden from the public catalog.",
      });
      setSelectedIds(new Set());
      void mutate();
    } catch (err) {
      toast.error("Could not archive the selection", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setArchiving(false);
    }
  }, [selected, setSelectedIds, mutate]);

  const remove = React.useCallback(async () => {
    if (!confirmDelete) return;
    const book = confirmDelete;
    setConfirmDelete(null);

    try {
      await booksApi.remove(book._id);
      toast.success("Book deleted", {
        description: `“${book.title}” has been removed from the catalog.`,
      });
      void mutate();
    } catch (err) {
      toast.error("Could not delete this book", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  }, [confirmDelete, mutate]);

  const activeFilters = [
    filters.q,
    filters.category,
    filters.status !== "all" ? filters.status : "",
    filters.sort !== "newest" ? filters.sort : "",
  ].filter(Boolean).length;

  const goToPage = (next: number) => {
    filters.set({ page: String(next) }, { resetPage: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="container-page space-y-6 pb-24 md:pb-6">
      <PageHeader
        title="Books"
        description="Add, edit and organise everything in the catalog."
        action={
          <Button onClick={() => router.push("/staff/books/new")}>
            <Plus className="size-4" aria-hidden="true" />
            Add book
          </Button>
        }
      />

      {/* ------------------------------- Toolbar ------------------------------- */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              value={filters.draft}
              onChange={(event) => filters.setDraft(event.target.value)}
              // Focus tells the hook the user owns the search text; see
              // `useBookFilters` for why that is the only reliable signal.
              onFocus={() => filters.setEditing(true)}
              onBlur={() => filters.setEditing(false)}
              placeholder="Search title, author, ISBN or tag…"
              aria-label="Search books"
              className="pl-10"
            />
            {filters.draft ? (
              <button
                type="button"
                onClick={() => filters.setDraft("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={filters.category || "all"}
              onValueChange={(value) => filters.set({ category: value === "all" ? undefined : value })}
            >
              <SelectTrigger className="w-full md:w-52" aria-label="Filter by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item._id} value={item._id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="shrink-0">
                  <ArrowUpDown className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{BOOK_SORT_LABELS[filters.sort]}</span>
                  <span className="sm:hidden">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {BOOK_SORTS.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onSelect={() => filters.set({ sort: option === "newest" ? undefined : option })}
                    className={option === filters.sort ? "bg-muted font-medium" : undefined}
                  >
                    {BOOK_SORT_LABELS[option]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={filters.status}
            onValueChange={(value) => filters.set({ status: value === "all" ? undefined : value })}
          >
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          {activeFilters > 0 ? (
            <>
              <Badge variant="soft" className="gap-1.5">
                <SlidersHorizontal className="size-3" aria-hidden="true" />
                {activeFilters} {activeFilters === 1 ? "filter" : "filters"} active
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={filters.reset}
                className="text-muted-foreground"
              >
                Reset
              </Button>
            </>
          ) : null}

          <p className="ms-auto text-small text-muted-foreground" aria-live="polite">
            {isLoading && !data ? "Loading…" : `${total} ${total === 1 ? "book" : "books"}`}
          </p>
        </div>
      </div>

      {/* -------------------------------- Results -------------------------------- */}
      {error && !data ? (
        <EmptyState
          icon={Search}
          title="Could not load books"
          description={error instanceof Error ? error.message : "Something went wrong."}
          action={
            <Button onClick={() => void mutate()}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <BooksTable
            books={books}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
            actions={{
              onEdit: (book) => router.push(`/staff/books/${book._id}/edit`),
              onToggleArchive: toggleArchive,
              onDelete: setConfirmDelete,
              onViewQueue: setQueueBook,
            }}
            emptyState={
              isLoading ? (
                <BookTableSkeleton />
              ) : (
                <div className="rounded-lg border border-border bg-surface">
                  <EmptyState
                    icon={Search}
                    title={activeFilters > 0 ? "No books match those filters" : "No books yet"}
                    description={
                      activeFilters > 0
                        ? "Try a different search term, or clear the filters to see the whole catalog."
                        : "Add the first book to start building the catalog."
                    }
                    action={
                      activeFilters > 0 ? (
                        <Button variant="outline" onClick={filters.reset}>
                          Clear filters
                        </Button>
                      ) : (
                        <Button onClick={() => router.push("/staff/books/new")}>
                          <Plus className="size-4" aria-hidden="true" />
                          Add book
                        </Button>
                      )
                    }
                  />
                </div>
              )
            }
          />

          {totalPages > 1 ? (
            <nav
              aria-label="Books pagination"
              className="flex flex-col items-center gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between"
            >
              <p className="text-small text-muted-foreground">
                Page {page} of {totalPages} · {total} in total
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}

      <BulkBar
        count={selected.size}
        onArchive={archiveSelected}
        onClear={() => setSelectedIds(new Set())}
        pending={archiving}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title={`Delete “${confirmDelete?.title ?? ""}”?`}
        consequence="This cannot be undone. A book that has ever been loaned cannot be deleted, and the library will offer to archive it instead."
        confirmLabel="Delete book"
        onConfirm={remove}
      />

      <ReservationQueueSheet
        book={queueBook ? { id: queueBook._id, title: queueBook.title, slug: queueBook.slug } : null}
        open={queueBook !== null}
        onOpenChange={(open) => {
          if (!open) setQueueBook(null);
        }}
      />
    </div>
  );
}

const EMPTY_SET = new Set<string>();

/** Skeleton that mirrors the table's row shape, so the layout does not jump. */
function BookTableSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading books">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-16 w-12 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Fetch the current page of books, keyed on the URL search string.
 *
 * The key is the serialised query, so the browser's back button and a shared link
 * both re-fetch the right page.
 *
 * **The fetcher takes no parameters, and that is load-bearing.** SWR invokes
 * `fetcher(key)`, so a fetcher declared as `(signal?: AbortSignal) => …` receives
 * the *string key* in that position and hands it straight to `fetch` as `signal`:
 * `Failed to read the 'signal' property from 'RequestInit'`. The unit shipped a
 * hard error state over a working API that way, and it only appeared once the
 * request actually fired — which took fixing the empty-key bug above to expose.
 *
 * Cancellation is therefore wired by hand. An in-flight request for a
 * superseded filter is aborted rather than left to race the new one and overwrite
 * it, which is what the cache key alone would not guarantee.
 */
function useSWRBooks(key: string, query: BookListFilters) {
  const controllerRef = React.useRef<AbortController | null>(null);

  return useSWR(key, async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      return await booksApi.list(query, controller.signal);
    } finally {
      // Only the newest request owns the slot; a slow earlier one must not clear
      // the handle belonging to the request that replaced it.
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  });
}
