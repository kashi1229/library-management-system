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
import { Badge } from "@/components/ui/badge";
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
      {/* Responsive table container with smooth borders and subtle shadow */}
      <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-surface shadow-xs md:block print:border-0 print:bg-transparent print:shadow-none">
        <Table containerClassName="overflow-x-auto">
          <TableHeader>
            <TableRow className="border-b border-border/70 bg-muted/40 hover:bg-muted/40">
              {columns.map((column) => {
                const active = sort === column.key;
                return (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "py-3.5 text-caption font-semibold tracking-wider text-muted-foreground uppercase",
                      column.align === "right" && "text-right",
                    )}
                    aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={cn(
                        "group -mx-1 inline-flex h-8 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-surface/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "font-bold text-foreground" : "text-muted-foreground",
                        column.align === "right" && "flex-row-reverse",
                      )}
                    >
                      <span className="truncate">{column.label}</span>
                      {active ? (
                        dir === "asc" ? (
                          <ArrowUp className="size-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3.5 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 shrink-0 opacity-40 transition-opacity group-hover:opacity-75" strokeWidth={1.75} aria-hidden="true" />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={String(row.id ?? index)}
                className="transition-colors duration-150 hover:bg-muted/40"
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "py-3.5 align-middle text-small",
                      column.align === "right" && "text-right tabular-nums",
                      column.emphasis && "font-medium text-foreground",
                    )}
                  >
                    {renderCell(column.key, row[column.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------- Mobile ------------------------------- */}
      {/* Polished mobile card view with clear visual grouping */}
      <ul className="space-y-3.5 md:hidden">
        {rows.map((row, index) => {
          const firstCol = columns[0];
          const restCols = columns.slice(1);
          return (
            <li
              key={String(row.id ?? index)}
              className="overflow-hidden rounded-xl border border-border/80 bg-surface p-4 shadow-xs transition-shadow duration-150 hover:shadow-soft"
            >
              {firstCol && (
                <div className="mb-3 border-b border-border/60 pb-2.5">
                  <span className="block text-caption font-medium text-muted-foreground">
                    {firstCol.label}
                  </span>
                  <div className="mt-0.5 text-body font-semibold text-foreground">
                    {renderCell(firstCol.key, row[firstCol.key])}
                  </div>
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {restCols.map((column) => (
                  <div key={column.key} className="space-y-0.5">
                    <dt className="text-caption font-medium text-muted-foreground truncate">
                      {column.label}
                    </dt>
                    <dd
                      className={cn(
                        "text-small tabular-nums text-foreground",
                        column.emphasis && "font-semibold text-foreground",
                      )}
                    >
                      {renderCell(column.key, row[column.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Intelligent cell rendering.
 * Formats known state/status values as badges for high readability, while
 * preserving exact strings and formatting.
 */
function renderCell(key: string, value: ReportRow[string]): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/60">—</span>;
  }

  const str = String(value);

  // Status/state column values styled with badges for visual clarity
  if (key === "state" || key === "status") {
    const lower = str.toLowerCase();
    if (lower === "returned" || lower === "paid" || lower === "active") {
      return (
        <Badge variant="success" className="capitalize text-caption">
          {str}
        </Badge>
      );
    }
    if (lower === "overdue" || lower === "unpaid" || lower === "suspended") {
      return (
        <Badge variant="danger" className="capitalize text-caption">
          {str}
        </Badge>
      );
    }
    if (lower === "waived" || lower === "waiting") {
      return (
        <Badge variant="warning" className="capitalize text-caption">
          {str}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="capitalize text-caption">
        {str}
      </Badge>
    );
  }

  return str;
}