"use client";

import * as React from "react";
import { Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryIconTile } from "@/components/common/category-icon-tile";
import type { CatalogFacets } from "@/types";
import type { CatalogFilters } from "@/hooks/use-catalog-filters";

/**
 * The catalog filter panel (F5), rendered identically in the desktop sticky column
 * and in the mobile bottom sheet.
 *
 * One component with two hosts, so the two cannot drift — the same reasoning as the
 * staff table's table/cards. It is presentational: every change goes through the
 * `filters` handle, which owns the URL.
 *
 * Category counts are shown but deliberately **not** recomputed as other filters
 * change. A facet that renumbers itself while you narrow a search reads as options
 * disappearing, which feels broken even when it is arithmetically honest.
 */
export function CatalogFilterPanel({
  filters,
  facets,
  className,
}: {
  filters: CatalogFilters;
  facets: CatalogFacets;
  className?: string;
}) {
  // Year inputs are strings while being typed; "" means "no bound".
  const [fromInput, setFromInput] = React.useState(
    filters.yearFrom != null ? String(filters.yearFrom) : "",
  );
  const [toInput, setToInput] = React.useState(
    filters.yearTo != null ? String(filters.yearTo) : "",
  );

  // Adopt URL changes from outside (Back, Reset, a shared link) without an effect.
  const [synced, setSynced] = React.useState(filters.yearFrom ?? filters.yearTo ?? "");
  const incoming = filters.yearFrom ?? filters.yearTo ?? "";
  if (incoming !== synced) {
    setSynced(incoming);
    setFromInput(filters.yearFrom != null ? String(filters.yearFrom) : "");
    setToInput(filters.yearTo != null ? String(filters.yearTo) : "");
  }

  const commitYears = (from: string, to: string) => {
    const parse = (value: string) => {
      const n = Number(value);
      return value.trim() !== "" && Number.isInteger(n) && n >= 1000 && n <= 3000 ? n : undefined;
    };
    const yearFrom = parse(from);
    const yearTo = parse(to);
    // An inverted range would match nothing and read as a bug, so clamp instead.
    if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) {
      filters.set({ yearFrom: yearTo, yearTo: yearFrom });
      return;
    }
    filters.set({ yearFrom, yearTo });
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* ------------------------------ Categories ----------------------------- */}
      <fieldset className="space-y-2.5">
        <legend className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
          Category
        </legend>

        <div className="space-y-0.5">
          <CategoryOption
            label="All categories"
            count={facets.categories.reduce((sum, c) => sum + c.count, 0)}
            active={!filters.category}
            onSelect={() => filters.set({ category: undefined })}
          />
          {facets.categories.map((category) => (
            <CategoryOption
              key={category._id}
              icon={category.icon}
              color={category.color}
              label={category.name}
              count={category.count}
              active={filters.category === category._id}
              onSelect={() =>
                filters.set({
                  category: filters.category === category._id ? undefined : category._id,
                })
              }
            />
          ))}
        </div>
      </fieldset>

      <Separator />

      {/* ----------------------------- Availability ---------------------------- */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="catalog-available" className="text-small font-medium text-foreground">
            Available now
          </label>
          <Switch
            id="catalog-available"
            checked={filters.availability === "available"}
            onCheckedChange={(checked) =>
              filters.set({ availability: checked ? "available" : undefined })
            }
          />
        </div>
        <p className="text-caption text-muted-foreground">
          Only books with a copy you could borrow today.
        </p>
      </div>

      <Separator />

      {/* ------------------------------- Language ------------------------------ */}
      <div className="space-y-2.5">
        <label
          htmlFor="catalog-language"
          className="text-caption font-semibold tracking-wide text-muted-foreground uppercase"
        >
          Language
        </label>
        <Select
          value={filters.language || "all"}
          onValueChange={(value) =>
            filters.set({ language: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger id="catalog-language" className="w-full">
            <SelectValue placeholder="Any language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any language</SelectItem>
            {facets.languages.map((language) => (
              <SelectItem key={language} value={language}>
                {language}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* ------------------------------ Year range ----------------------------- */}
      <fieldset className="space-y-2.5">
        <legend className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">
          Year
        </legend>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder={String(facets.yearRange.from)}
            aria-label="Earliest publication year"
            min={facets.yearRange.from}
            max={facets.yearRange.to}
            value={fromInput}
            onChange={(event) => setFromInput(event.target.value)}
            onBlur={() => commitYears(fromInput, toInput)}
            className="h-10 font-mono text-code"
          />
          <span aria-hidden="true" className="text-caption text-muted-foreground">
            to
          </span>
          <Input
            type="number"
            inputMode="numeric"
            placeholder={String(facets.yearRange.to)}
            aria-label="Latest publication year"
            min={facets.yearRange.from}
            max={facets.yearRange.to}
            value={toInput}
            onChange={(event) => setToInput(event.target.value)}
            onBlur={() => commitYears(fromInput, toInput)}
            className="h-10 font-mono text-code"
          />
        </div>
        <p className="text-caption text-muted-foreground">
          Catalog holds {facets.yearRange.from}–{facets.yearRange.to}.
        </p>
      </fieldset>

      {filters.activeCount > 0 ? (
        <Button variant="outline" size="sm" onClick={filters.reset} className="w-full">
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Clear all filters
        </Button>
      ) : null}
    </div>
  );
}

/**
 * One category row.
 *
 * The whole row is a `<button>` with `aria-pressed`, so it is reachable by keyboard
 * and announces its own selected state. The check mark is a second, non-colour cue —
 * selection must not be conveyed by the accent tint alone.
 */
function CategoryOption({
  label,
  count,
  icon,
  color,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  icon?: string;
  color?: "forest" | "terracotta" | "ocean" | "plum" | "ochre" | "slate";
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-small transition-colors",
        "hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none",
        active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {icon && color ? (
        <CategoryIconTile
          icon={icon}
          color={color}
          className="size-6 shrink-0 rounded-[4px] [&_svg]:size-3.5"
        />
      ) : (
        <span
          aria-hidden="true"
          className="size-6 shrink-0 rounded-[4px] bg-muted"
        />
      )}

      <span className="min-w-0 flex-1 truncate">{label}</span>

      {active ? (
        <Check className="size-4 shrink-0 text-accent-ink" strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <span className="shrink-0 font-mono text-caption text-muted-foreground/80">{count}</span>
      )}
    </button>
  );
}