"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionChip } from "@/components/features/audit/action-chip";
import type { AuditListItem } from "@/types";

/**
 * The audit register, newest first.
 *
 * **The `summary` recorded at the time of the action is what is shown**, never a title re-derived
 * from the entity. The log is append-only and outlives the documents it describes, so a deleted
 * book's `book.delete` row still has to read as it did — re-joining to a live `Book` would blank
 * the one entry an administrator most wants to read.
 *
 * **A row expands to show `meta`.** The structured detail is where the consequence of an action
 * lives (`before`/`after` on a book edit, the counts on a maintenance run), and an audit trail
 * that shows only "Book updated" is a list of events rather than a record of what they did.
 *
 * **Relative time with the absolute one beside it**, and the absolute one in `sr-only` text as
 * well as the `title` — a `title` is unreachable by touch, and somebody reconstructing an
 * incident on a phone needs the clock time, not "2 days ago".
 */
export function AuditTable({
  items,
  emptyState,
}: {
  items: AuditListItem[];
  emptyState?: React.ReactNode;
}) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  if (items.length === 0) return <>{emptyState}</>;

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {/* ------------------------------ Desktop ------------------------------ */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Action</TableHead>
              <TableHead className="min-w-[18rem]">Summary</TableHead>
              <TableHead className="min-w-[10rem]">Actor</TableHead>
              <TableHead className="w-44">When</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Detail</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const open = expanded[item.id] === true;
              const metaKeys = Object.keys(item.meta ?? {});
              return (
                <React.Fragment key={item.id}>
                  <TableRow>
                    <TableCell>
                      <ActionChip action={item.action} />
                    </TableCell>
                    <TableCell className="text-foreground">{item.summary}</TableCell>
                    <TableCell>
                      <span className="block truncate text-small text-foreground">
                        {item.actor?.name ?? "Unknown user"}
                      </span>
                      <span className="block truncate text-caption text-muted-foreground">
                        {/* A deleted account leaves the entry with an actor that no longer
                            resolves. "Removed user" is honest; a blank cell reads as "nobody
                            did this". */}
                        {item.actor ? item.actor.role : "removed account"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <time dateTime={item.createdAt} title={formatDate(item.createdAt, "d MMM yyyy, HH:mm")}>
                        {formatRelative(item.createdAt)}
                      </time>
                      <span className="sr-only">
                        {" "}
                        — {formatDate(item.createdAt, "d MMM yyyy 'at' HH:mm")}
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* **The expander only exists when there is something to expand.** A
                          control that opens an empty panel is a dead control. */}
                      {metaKeys.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          aria-expanded={open}
                          className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <ChevronDown
                            className={cn("size-4 transition-transform", open && "rotate-180")}
                            strokeWidth={1.75}
                            aria-hidden="true"
                          />
                          <span className="sr-only">
                            {open ? "Hide" : "Show"} detail for {item.summary}
                          </span>
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={5} className="p-0">
                        <MetaDetail meta={item.meta} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------- Mobile ------------------------------- */}
      <ul className="space-y-3 md:hidden">
        {items.map((item) => {
          const open = expanded[item.id] === true;
          const metaKeys = Object.keys(item.meta ?? {});
          return (
            <li key={item.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <ActionChip action={item.action} />
                <time
                  dateTime={item.createdAt}
                  className="shrink-0 text-caption text-muted-foreground"
                  title={formatDate(item.createdAt, "d MMM yyyy, HH:mm")}
                >
                  {formatRelative(item.createdAt)}
                </time>
              </div>
              <p className="mt-2 text-small text-foreground text-pretty">{item.summary}</p>
              <p className="mt-1 text-caption text-muted-foreground">
                {item.actor?.name ?? "Unknown user"}
                {item.actor ? ` · ${item.actor.role}` : " · removed account"}
              </p>
              {metaKeys.length > 0 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-expanded={open}
                    className="inline-flex items-center gap-1 text-caption font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <ChevronDown
                      className={cn("size-3.5 transition-transform", open && "rotate-180")}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    {open ? "Hide detail" : "Show detail"}
                  </button>
                  {open ? <MetaDetail meta={item.meta} /> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * `meta` as key/value pairs.
 *
 * **Values are rendered with a type check, not interpolated blind.** `meta` is `Schema.Types.Mixed`
 * — anything a service chose to record — so a nested object or an array would otherwise print as
 * `[object Object]`. Dates are formatted and objects are JSON-stringified, because the alternative
 * is an entry that says nothing at exactly the moment somebody is reading the trail.
 */
function MetaDetail({ meta }: { meta: Record<string, unknown> }) {
  const entries = Object.entries(meta ?? {});
  if (entries.length === 0) return null;

  return (
    <dl className="grid gap-x-6 gap-y-2 p-4 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-caption font-medium text-muted-foreground">{humaniseKey(key)}</dt>
          <dd className="mt-0.5 break-words font-mono text-caption text-foreground">{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** `daysOverdue` → `Days overdue`. */
function humaniseKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    // An ISO timestamp in `meta` should read as a date, not as a raw `2026-10-10T…Z`.
    const asDate = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(asDate.getTime())) {
      return formatDate(asDate, "d MMM yyyy, HH:mm");
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}