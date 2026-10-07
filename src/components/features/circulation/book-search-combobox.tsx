"use client";

import * as React from "react";
import { useCallback } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookCover } from "@/components/common/book-cover";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { useRemoteCombobox } from "@/hooks/use-remote-combobox";
import { booksApi, type BookSummary } from "@/lib/api-client";

/**
 * Book picker for the issue form (spec 12).
 *
 * Searches `GET /api/books` with the **staff** query, which returns `BookSummary` —
 * including `availableCopies` and `totalCopies`. Those two numbers are the whole point of
 * this control: a librarian is choosing a book to give away, so "3 of 5 available" belongs
 * on the row, not two clicks away.
 *
 * `status: "active"` is sent explicitly, so **archived books are never offered** rather
 * than being selectable and then refused by the server. Hiding the dead option is the
 * difference between a desk tool and a puzzle.
 *
 * A book with no free copy is still **selectable and badged "None left"** rather than
 * filtered out: the librarian may be about to return it, and the ticket explains the
 * refusal in a sentence they can read to the member.
 *
 * Same interaction contract as `MemberSearchCombobox`, via the shared
 * `useRemoteCombobox` hook.
 */
export function BookSearchCombobox({
  value,
  onChange,
  autoFocus,
  className,
}: {
  value: BookSummary | null;
  onChange: (book: BookSummary | null) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const combo = useRemoteCombobox<BookSummary>({
    query: useCallback(async (term, signal) => {
      const page = await booksApi.list({ q: term, status: "active", limit: 8 }, signal);
      return page.data.items;
    }, []),
    onChoose: useCallback(
      (book: BookSummary) => {
        onChange(book);
        inputRef.current?.focus();
      },
      [onChange],
    ),
  });

  if (value) {
    return (
      <div className={cn("rounded-lg border border-border bg-muted/40 p-4", className)}>
        <div className="flex items-center gap-3">
          <BookCover
            publicId={value.cover?.publicId}
            url={value.cover?.url}
            title={value.title}
            author={value.authors[0] ?? null}
            categoryColor={value.category.color}
            width={48}
            sizes="48px"
            className="h-16 w-11 shrink-0 rounded-sm"
          />

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-small font-medium text-foreground">{value.title}</p>
            <p className="mt-0.5 truncate text-caption text-muted-foreground">
              {value.authors.join(", ") || value.category.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <AvailabilityBadge available={value.availableCopies} total={value.totalCopies} />
              {value.shelfLocation ? (
                <span className="font-mono text-caption text-muted-foreground">
                  {value.shelfLocation}
                </span>
              ) : null}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Choose a different book"
            onClick={() => onChange(null)}
            className="shrink-0 text-muted-foreground"
          >
            <X className="size-4" strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  const showEmpty = combo.open && !combo.tooShort && !combo.loading && combo.items.length === 0;

  return (
    <div className={cn("relative", className)}>
      <label htmlFor="desk-book-search" className="text-small font-medium text-foreground">
        Book
      </label>
      <p className="mt-0.5 text-caption text-muted-foreground">
        Search by title or ISBN. Archived titles are not listed.
      </p>

      <div className="relative mt-2">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          id="desk-book-search"
          ref={inputRef}
          value={combo.term}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={combo.open}
          aria-controls="desk-book-listbox"
          aria-autocomplete="list"
          placeholder="e.g. 9780262033848 or Structure"
          onChange={(event) => combo.setTerm(event.target.value)}
          onFocus={() => combo.setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => combo.setOpen(false), 120);
          }}
          onKeyDown={combo.onKeyDown}
          className="pl-10"
        />
      </div>

      {combo.open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-border bg-popover shadow-lift">
          {combo.loading && combo.items.length === 0 ? (
            <p className="px-4 py-6 text-center text-small text-muted-foreground">Searching…</p>
          ) : combo.tooShort ? (
            <p className="px-4 py-6 text-center text-small text-muted-foreground">
              Type at least two characters.
            </p>
          ) : showEmpty ? (
            <p className="px-4 py-8 text-center text-small text-muted-foreground">
              No active book matches “{combo.term.trim()}”.
            </p>
          ) : (
            <ul
              id="desk-book-listbox"
              role="listbox"
              aria-label="Book results"
              className="max-h-80 overflow-y-auto p-1"
            >
              {combo.items.map((book, index) => {
                const active = index === combo.highlighted;
                const noneLeft = book.availableCopies === 0;

                return (
                  <li key={book._id} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        combo.choose(book);
                      }}
                      onMouseEnter={() => combo.setHighlighted(index)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        active ? "bg-primary-soft" : "hover:bg-muted",
                      )}
                    >
                      <BookCover
                        publicId={book.cover?.publicId}
                        url={book.cover?.url}
                        title={book.title}
                        author={book.authors[0] ?? null}
                        categoryColor={book.category.color}
                        width={36}
                        sizes="36px"
                        className="h-12 w-8 shrink-0 rounded-sm"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1 block text-small font-medium text-foreground">
                          {book.title}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground">
                          {book.authors.join(", ") || book.isbn || book.category.name}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-2">
                        {noneLeft ? (
                          <Badge variant="danger">None left</Badge>
                        ) : (
                          <span className="font-mono text-caption text-muted-foreground">
                            {book.availableCopies}/{book.totalCopies}
                          </span>
                        )}
                        {active ? (
                          <Check
                            className="size-4 shrink-0 text-primary"
                            strokeWidth={2.5}
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {combo.open && !combo.loading && !combo.tooShort && combo.items.length > 0
          ? `${combo.items.length} book${combo.items.length === 1 ? "" : "s"} found`
          : ""}
      </span>
    </div>
  );
}