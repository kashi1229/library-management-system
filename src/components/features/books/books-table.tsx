"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookCover } from "@/components/common/book-cover";
import { CopiesBar } from "@/components/features/books/copies-bar";
import { BookCategoryChip } from "@/components/features/books/book-category-chip";
import { BookStatusPill } from "@/components/features/books/book-status-pill";
import {
  BookRowActionMenu,
  type BookRowActions,
} from "@/components/features/books/book-row-actions";
import type { BookSummary } from "@/lib/api-client";

/**
 * The staff book table.
 *
 * One component renders **both** layouts from the same data: a real `<table>`
 * from `md` up, and stacked cards below it. Duplicating the rows as JSX would let
 * the two drift, and every column change would need editing twice — the same
 * failure mode the Unit 07 card hit.
 *
 * Select-all is a tri-state checkbox: indeterminate when a subset is chosen, so
 * "archive selected" is never ambiguous about what it will do. Under `md` the
 * header checkbox is duplicated at the top of the card list, because a bulk
 * action with no visible select-all is a bulk action nobody can start.
 */
export function BooksTable({
  books,
  selected,
  onToggle,
  onToggleAll,
  actions,
  emptyState,
}: {
  books: BookSummary[];
  /** Ids currently selected for the bulk action. */
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  actions: BookRowActions;
  /** Rendered when `books` is empty. */
  emptyState?: React.ReactNode;
}) {
  const allSelected = books.length > 0 && books.every((book) => selected.has(book._id));
  const someSelected = books.some((book) => selected.has(book._id));

  if (books.length === 0) return <>{emptyState}</>;

  return (
    <>
      {/* ------------------------------ Desktop ------------------------------ */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <SelectAllCheckbox
                  allSelected={allSelected}
                  someSelected={someSelected}
                  onToggleAll={onToggleAll}
                />
              </TableHead>
              <TableHead className="min-w-[16rem]">Book</TableHead>
              <TableHead className="w-36">ISBN</TableHead>
              <TableHead className="w-44">Category</TableHead>
              <TableHead className="w-48">Copies</TableHead>
              <TableHead className="w-24">Shelf</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {books.map((book) => (
              <TableRow
                key={book._id}
                data-state={selected.has(book._id) ? "selected" : undefined}
                className={cn(book.status === "archived" && "opacity-70")}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(book._id)}
                    onCheckedChange={() => onToggle(book._id)}
                    aria-label={`Select ${book.title}`}
                  />
                </TableCell>

                <TableCell className="whitespace-normal">
                  <div className="flex items-center gap-3">
                    <BookCover
                      publicId={book.cover?.publicId}
                      url={book.cover?.url}
                      title={book.title}
                      author={book.authors[0]}
                      categoryColor={book.category.color}
                      width={96}
                      sizes="96px"
                      className="w-12 shrink-0"
                    />
                    <div className="min-w-0">
                      <BookTitleLink book={book} />
                      <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">
                        {book.authors.join(", ")}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <code className="font-mono text-code text-muted-foreground">
                    {book.isbn ?? "—"}
                  </code>
                </TableCell>

                <TableCell>
                  <BookCategoryChip category={book.category} />
                </TableCell>

                {/* `whitespace-normal` because the base `TableCell` sets
                    `whitespace-nowrap`, and the availability label ("2 of 5
                    available") is wider than the column at `md`. A nowrap label in
                    a tight column overflows its cell rather than wrapping. */}
                <TableCell className="whitespace-normal">
                  <CopiesBar available={book.availableCopies} total={book.totalCopies} />
                </TableCell>

                <TableCell>
                  <span className="font-mono text-code text-muted-foreground">
                    {book.shelfLocation || "—"}
                  </span>
                </TableCell>

                <TableCell>
                  <BookStatusPill book={book} />
                </TableCell>

                <TableCell>
                  <BookRowActionMenu book={book} actions={actions} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------- Mobile ------------------------------- */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
          <SelectAllCheckbox
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleAll={onToggleAll}
          />
          <p className="text-caption text-muted-foreground">
            {someSelected || allSelected ? "Clear selection" : "Select all on this page"}
          </p>
        </div>

        <ul className="space-y-3" aria-label="Books">
          {books.map((book) => (
            <li
              key={book._id}
              className={cn(
                "rounded-lg border border-border bg-surface p-4 transition-colors",
                selected.has(book._id) && "border-primary bg-primary-soft/40",
                book.status === "archived" && "opacity-70",
              )}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected.has(book._id)}
                  onCheckedChange={() => onToggle(book._id)}
                  aria-label={`Select ${book.title}`}
                  className="mt-1"
                />
                <BookCover
                  publicId={book.cover?.publicId}
                  url={book.cover?.url}
                  title={book.title}
                  author={book.authors[0]}
                  categoryColor={book.category.color}
                  width={120}
                  sizes="72px"
                  className="w-[3.375rem] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <BookTitleLink book={book} />
                    <BookRowActionMenu book={book} actions={actions} />
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-caption text-muted-foreground">
                    {book.authors.join(", ")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <BookStatusPill book={book} />
                    <BookCategoryChip category={book.category} />
                  </div>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-caption">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">ISBN</dt>
                  <dd className="truncate font-mono text-code">{book.isbn ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Shelf</dt>
                  <dd className="truncate font-mono text-code">{book.shelfLocation || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="mb-1 text-muted-foreground">Copies</dt>
                  <dd>
                    <CopiesBar
                      available={book.availableCopies}
                      total={book.totalCopies}
                      className="min-w-0"
                    />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>

      {/* Screen readers get the row count once, not per layout. */}
      <span className="sr-only" data-slot="book-count">
        {books.length} {books.length === 1 ? "book" : "books"} listed
      </span>
    </>
  );
}

function SelectAllCheckbox({
  allSelected,
  someSelected,
  onToggleAll,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
}) {
  return (
    <Checkbox
      checked={allSelected ? true : someSelected ? "indeterminate" : false}
      onCheckedChange={onToggleAll}
      aria-label={allSelected ? "Clear selection" : "Select all books on this page"}
      data-testid="select-all"
    />
  );
}

/**
 * Title links to the edit page, so the row itself is a navigation target.
 *
 * `inline-block` plus a minimum height keeps the pointer target at 24px. A plain
 * inline link wraps to the text's line box, which is 22px — under WCAG 2.2 SC
 * 2.5.8, and the primary click target in the table.
 */
function BookTitleLink({ book }: { book: BookSummary }) {
  return (
    <Link
      href={`/staff/books/${book._id}/edit`}
      className={cn(
        "inline-block min-h-6 py-0.5 line-clamp-2 font-medium text-foreground underline-offset-2 hover:underline",
        "focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none",
      )}
    >
      {book.title}
    </Link>
  );
}
