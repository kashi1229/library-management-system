"use client";

import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOOK_SORT_LABELS } from "@/lib/constants";
import { PUBLIC_BOOK_SORTS, type PublicBookSort } from "@/lib/validators/book";
import type { CatalogFilters } from "@/hooks/use-catalog-filters";

/** How results are laid out. Persisted locally, never in the URL. */
export type CatalogView = "grid" | "list";

/**
 * Result count, view toggle and sort (F5).
 *
 * The count is the only thing on this row that states a fact. It is `aria-live`, so
 * a screen-reader user hears the result set change after every filter — the visual
 * equivalent is the list re-rendering, which they would otherwise miss entirely.
 *
 * The view toggle uses `aria-pressed` and both icons carry text, so the control
 * reads as "Grid, pressed" rather than announcing two unlabelled icons.
 */
export function CatalogToolbar({
  filters,
  total,
  loading,
  view,
  onViewChange,
  className,
}: {
  filters: CatalogFilters;
  total: number;
  loading: boolean;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <p aria-live="polite" className="text-small text-muted-foreground">
        {loading ? (
          "Searching…"
        ) : (
          <>
            <span className="font-medium text-foreground">{total}</span>{" "}
            {total === 1 ? "book" : "books"}
          </>
        )}
      </p>

      {filters.activeCount > 0 ? (
        <Badge variant="soft" className="gap-1.5">
          <SlidersHorizontal className="size-3" aria-hidden="true" />
          {filters.activeCount} {filters.activeCount === 1 ? "filter" : "filters"}
        </Badge>
      ) : null}

      <div className="ms-auto flex items-center gap-2">
        <div
          role="group"
          aria-label="Result layout"
          className="hidden items-center gap-1 rounded-md border border-border p-0.5 sm:flex"
        >
          <ViewButton
            active={view === "grid"}
            label="Grid"
            onClick={() => onViewChange("grid")}
            icon={<LayoutGrid className="size-4" aria-hidden="true" />}
          />
          <ViewButton
            active={view === "list"}
            label="List"
            onClick={() => onViewChange("list")}
            icon={<List className="size-4" aria-hidden="true" />}
          />
        </div>

        <Select
          value={filters.sort}
          onValueChange={(value) =>
            filters.set({ sort: value === "newest" ? undefined : (value as PublicBookSort) })
          }
        >
          <SelectTrigger className="w-40" aria-label="Sort results">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PUBLIC_BOOK_SORTS.map((option) => (
              <SelectItem key={option} value={option}>
                {BOOK_SORT_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** The large search field above the toolbar (F5). */
export function CatalogSearch({
  filters,
  className,
}: {
  filters: CatalogFilters;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <label htmlFor="catalog-search" className="sr-only">
        Search the catalog by title, author, ISBN or tag
      </label>
      <Input
        id="catalog-search"
        type="search"
        value={filters.draft}
        onChange={(event) => filters.setDraft(event.target.value)}
        onFocus={() => filters.setEditing(true)}
        onBlur={() => filters.setEditing(false)}
        placeholder="Search by title, author, ISBN or tag…"
        autoComplete="off"
        className="h-12 ps-11"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function ViewButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} view`}
      className={cn(
        "text-muted-foreground hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {icon}
    </Button>
  );
}