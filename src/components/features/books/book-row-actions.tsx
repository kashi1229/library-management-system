"use client";

import { Archive, MoreHorizontal, Pencil, RotateCcw, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BookSummary } from "@/lib/api-client";

/** What the row menu can do. Owned by the table, so the menu stays dumb. */
export type BookRowActions = {
  onEdit: (book: BookSummary) => void;
  onToggleArchive: (book: BookSummary) => void;
  onDelete: (book: BookSummary) => void;
  /**
   * Open the book's reservation queue (Unit 14).
   *
   * Present on **every** row, including one with an empty queue: a librarian checking
   * whether a title is oversubscribed should not have to know in advance, and the sheet says
   * "nobody is queuing" rather than leaving the question unanswered.
   */
  onViewQueue: (book: BookSummary) => void;
};

/**
 * Per-row overflow menu.
 *
 * The trigger is always mounted and never disabled, so keyboard users keep a
 * stable tab stop; Radix's `DropdownMenu` handles the focus handoff into the menu
 * and returns it to the trigger on close.
 *
 * Delete is separated and tinted `danger` because it is the only irreversible
 * action here, and the label says "Delete" rather than an icon so the menu reads
 * without colour.
 */
export function BookRowActionMenu({
  book,
  actions,
  align = "end",
}: {
  book: BookSummary;
  actions: BookRowActions;
  align?: "start" | "center" | "end";
}) {
  const archived = book.status === "archived";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${book.title}`}
          className="shrink-0 text-muted-foreground"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="min-w-44">
        <DropdownMenuItem onSelect={() => actions.onEdit(book)}>
          <Pencil className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Edit details
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => actions.onToggleArchive(book)}>
          {archived ? (
            <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Archive className="size-4" strokeWidth={1.75} aria-hidden="true" />
          )}
          {archived ? "Restore to catalog" : "Archive"}
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => actions.onViewQueue(book)}>
          <Users className="size-4" strokeWidth={1.75} aria-hidden="true" />
          View queue
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => actions.onDelete(book)}
          className="text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
        >
          <Trash2 className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Delete permanently
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}