"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportColumn, ReportRow } from "@/types";

/**
 * One table for all six reports.
 *
 * **`columns` is the schema.** There is no per-report table component because there is no
 * per-report *shape*: the service has already turned every field into a display string, so the
 * table only has to lay out whatever keys it is handed. That is what makes a seventh report a
 * service change and nothing else.
 *
 * **The desktop and mobile layouts render from the same array**, exactly as `MembersTable`,
 * `BooksTable` and `LoansTable` do — two layouts from one source, so they cannot drift.
 *
 * **Sorting lives in the headers** and is a `push`, because it is a discrete choice and Back
 * should undo it. Sorting is done by the *service*, before pagination: sorting a page in the
 * browser would order page one correctly and then splice page two's rows into the wrong places.
 */
export function ReportTable({
  columns,
  rows,
  sort,
  dir,
  onSort,
  emptyState,
}: {
  columns: ReportColumn[];
  rows: ReportRow[];
  sort?: string;
  dir?: "asc" | "desc";
  onSort: (key: string) => void;
  emptyState?: React.ReactNode;
}) {
  if (rows.length === 0) return <>{emptyState}</>;

  return (
    <>
      {/* ------------------------------ Desktop ------------------------------ */}
      {/* `overflow-hidden` on the wrapper is deliberate (Unit 14's lesson): a table that outgrows
          its box clips the last column with nothing to indicate it, so the columns carry a min
          width and the wrapper is checked against its own `scrollWidth` in QA. */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block print:border-0 print:bg-transparent">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const active = sort === column.key;
                return (
                  <TableHead
                    key={column.key}
                    className={cn(column.align === "right" && "text-right")}
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={cn(
                        "-mx-1 inline-flex h-8 items-center gap-1 rounded px-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "text-foreground" : "text-muted-foreground",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      <span className="truncate">{column.label}</span>
                      {active ? (
                        dir === "asc" ? (
                          <ArrowUp className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 shrink-0 opacity-50" strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={String(row.id ?? index)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      column.align === "right" && "text-right tabular-nums",
                      column.emphasis && "font-medium text-foreground",
                    )}
                  >
                    {cell(row[column.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------- Mobile ------------------------------- */}
      {/* **Every column is shown**, as label/value pairs, because a report row dropped to fit is a
          number missing from a table somebody is about to quote. */}
      <ul className="space-y-3 md:hidden">
        {rows.map((row, index) => (
          <li key={String(row.id ?? index)} className="rounded-lg border border-border bg-surface p-4">
            <dl className="space-y-1.5">
              {columns.map((column) => (
                <div key={column.key} className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-caption text-muted-foreground">{column.label}</dt>
                  <dd
                    className={cn(
                      "min-w-0 text-end text-small tabular-nums",
                      column.emphasis && "font-medium text-foreground",
                    )}
                  >
                    {cell(row[column.key])}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * One cell, for every report.
 *
 * **A missing key renders an em dash, never `undefined`.** `columns` is the schema and a row is
 * built independently of it, so a report that drops a field would otherwise print the literal
 * string "undefined" into a table somebody might export. The em dash is this codebase's existing
 * "no value" convention (`formatDate` returns it for the same reason).
 */
function cell(value: ReportRow[string]): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  return String(value);
}