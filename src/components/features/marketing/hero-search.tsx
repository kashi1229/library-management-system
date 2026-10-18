"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2, Search, Sparkles, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/common/book-cover";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { useRemoteCombobox } from "@/hooks/use-remote-combobox";
import { catalogApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { CatalogBook } from "@/types";

type Suggestion = Pick<
  CatalogBook,
  | "_id"
  | "title"
  | "slug"
  | "authors"
  | "cover"
  | "category"
  | "effectiveAvailable"
  | "totalCopies"
  | "ratingAvg"
  | "ratingCount"
  | "publishedYear"
>;

const MIN_TERM = 2;
const DEBOUNCE_MS = 220;

/** Popular search tags for one-click catalog queries. */
const POPULAR_SEARCHES = [
  { label: "Computer Science", query: "Computer Science" },
  { label: "Algorithms", query: "Algorithms" },
  { label: "Literature", query: "Literature" },
  { label: "History", query: "History" },
] as const;

/**
 * Industrial-grade hero search engine combobox.
 *
 * Capabilities:
 * - Real-time catalog suggestions with debounced abortable queries.
 * - Cover thumbnail, author, publication year, rating, and availability preview.
 * - Quick filter tags below the input for one-tap exploration.
 * - Fast clear button when input has text.
 * - Full ARIA combobox pattern with active descendant keyboard navigation.
 */
export function HeroSearch({ className }: { className?: string }) {
  const router = useRouter();
  const listId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [focused, setFocused] = React.useState(false);

  const combobox = useRemoteCombobox<Suggestion>({
    query: async (term, signal) => {
      const response = await catalogApi.list({ q: term, limit: 6 }, signal);
      return response.data.items;
    },
    onChoose: (book) => router.push(`/catalog/${book.slug}`),
    minLength: MIN_TERM,
    debounceMs: DEBOUNCE_MS,
  });

  const { open, setOpen, term, setTerm } = combobox;
  const listOpen = open && combobox.items.length > 0;

  // Dismiss dropdown on outside clicks
  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, setOpen]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = term.trim();

    if (listOpen) {
      const picked = combobox.items[combobox.highlighted];
      if (picked) {
        combobox.choose(picked);
        return;
      }
    }

    if (!trimmed) {
      router.push("/catalog");
      return;
    }

    router.push(`/catalog?${new URLSearchParams({ q: trimmed }).toString()}`);
  }

  function handleQuickTag(query: string) {
    setTerm(query);
    router.push(`/catalog?${new URLSearchParams({ q: query }).toString()}`);
  }

  return (
    <div ref={rootRef} className={cn("relative w-full max-w-xl", className)}>
      <form
        role="search"
        onSubmit={onSubmit}
        className={cn(
          "relative flex w-full items-center gap-2 rounded-xl border bg-surface/95 p-1.5 shadow-lift backdrop-blur-md transition-all duration-200",
          listOpen || focused
            ? "border-ring/50 ring-[3px] ring-ring/15 shadow-lift"
            : "border-border hover:border-border/80",
        )}
      >
        <label htmlFor="hero-search" className="sr-only">
          Search the catalog by title, author or ISBN
        </label>

        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            strokeWidth={1.75}
            className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
          />
          <input
            id="hero-search"
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              listOpen ? `${listId}-opt-${combobox.highlighted}` : undefined
            }
            value={term}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={combobox.onKeyDown}
            placeholder="Search titles, authors, subjects, or ISBN…"
            className="h-11 w-full rounded-lg border border-transparent bg-transparent ps-11 pe-16 text-body text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />

          <div className="absolute end-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {combobox.loading ? (
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin text-accent-ink"
              />
            ) : term.length > 0 ? (
              <button
                type="button"
                onClick={() => setTerm("")}
                aria-label="Clear search input"
                className="grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <Button
          type="submit"
          className="h-11 shrink-0 px-5 font-medium shadow-sm transition-transform active:scale-[0.98]"
        >
          Search
        </Button>
      </form>

      {/* Popular quick searches */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-1">
        <span className="text-caption font-medium text-muted-foreground">
          Popular:
        </span>
        {POPULAR_SEARCHES.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleQuickTag(item.query)}
            className="inline-flex items-center rounded-md border border-border/80 bg-surface/70 px-2.5 py-1 text-caption text-foreground/80 transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground active:scale-[0.97]"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Combobox suggestions dropdown */}
      {listOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Catalog book suggestions"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lift backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {combobox.items.map((book, index) => {
            const isHighlighted = index === combobox.highlighted;

            return (
              <li key={book._id}>
                <button
                  type="button"
                  id={`${listId}-opt-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    combobox.choose(book);
                  }}
                  onMouseEnter={() => combobox.setHighlighted(index)}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-lg p-2.5 text-start transition-colors",
                    isHighlighted ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="w-10 shrink-0 shadow-sm">
                    <BookCover
                      publicId={book.cover?.publicId}
                      url={book.cover?.url}
                      title={book.title}
                      author={book.authors[0]}
                      categoryColor={book.category.color}
                      width={60}
                      sizes="60px"
                      alt=""
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold text-foreground">
                      {book.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-caption text-muted-foreground">
                      <span className="truncate">{book.authors.join(", ")}</span>
                      {book.publishedYear ? (
                        <>
                          <span>·</span>
                          <span className="tabular-nums font-mono text-[11px]">
                            {book.publishedYear}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <AvailabilityBadge
                      available={book.effectiveAvailable}
                      total={book.totalCopies}
                      size="sm"
                    />
                    {book.ratingCount > 0 ? (
                      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums">
                        <Star
                          className="size-3 fill-accent text-accent"
                          aria-hidden="true"
                        />
                        {book.ratingAvg.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}

          <li className="mt-1.5 border-t border-border pt-1.5">
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                router.push(
                  `/catalog?${new URLSearchParams({ q: term.trim() }).toString()}`,
                );
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-small font-medium text-accent-ink transition-colors hover:bg-muted"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Sparkles
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-accent"
                />
                <span className="truncate">
                  Explore all catalog matches for “{term.trim()}”
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4 shrink-0"
              />
            </button>
          </li>
        </ul>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {combobox.loading
          ? "Searching the catalog."
          : combobox.tooShort
            ? `Type at least ${MIN_TERM} characters to search.`
            : listOpen
              ? `${combobox.items.length} suggestions available. Use arrow keys to select.`
              : ""}
      </p>
    </div>
  );
}