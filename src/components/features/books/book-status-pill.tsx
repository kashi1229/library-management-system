"use client";

import { Badge } from "@/components/ui/badge";
import type { BookSummary } from "@/lib/api-client";

/**
 * The single most consequential fact about a row, given the least amount of ink.
 *
 * Precedence matters: an archived book is described as **Archived** even when its
 * copies are all out, because "archived" is the fact that changes where the book
 * appears. A dimmed row (set by the table) carries the same information again, so
 * this never depends on colour alone.
 */
export function BookStatusPill({ book }: { book: BookSummary }) {
  if (book.status === "archived") return <Badge variant="secondary">Archived</Badge>;
  if (book.availableCopies <= 0) return <Badge variant="danger">None out</Badge>;
  if (book.availableCopies <= 1) return <Badge variant="warning">Low stock</Badge>;
  return <Badge variant="success">Active</Badge>;
}