"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useRovingRadio } from "@/hooks/use-roving-radio";
import { RESOLVED_CATEGORY_ICONS } from "@/lib/icons";
import type { CategoryIconName } from "@/lib/validators/category";

/**
 * Searchable grid of category icons (spec 07).
 *
 * The choice is echoed straight back through `onChange`, so the dialog's live
 * preview and the card tile update on the same tick.
 *
 * Arrow keys move between tiles via `useRovingRadio`, and only the selected tile
 * is in the tab order, so a 42-icon grid never swallows 42 tab stops.
 */
export function IconPicker({
  value,
  onChange,
  id,
  className,
}: {
  value: CategoryIconName;
  onChange: (name: CategoryIconName) => void;
  /** Id for the search input, so `Field`'s `<label for>` targets a real control. */
  id: string;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const gridId = React.useId();

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return RESOLVED_CATEGORY_ICONS;
    // The current selection always stays visible: a radiogroup whose checked
    // option is filtered out has nothing to focus and cannot be read out.
    return RESOLVED_CATEGORY_ICONS.filter(
      (entry) => entry.name.toLowerCase().includes(needle) || entry.name === value,
    );
  }, [query, value]);

  const optionId = React.useCallback(
    (name: CategoryIconName) => `${gridId}-${name}`,
    [gridId],
  );
  const optionIds = React.useMemo(
    () => filtered.map((entry) => optionId(entry.name)),
    [filtered, optionId],
  );

  const { register, onKeyDown } = useRovingRadio({
    ids: optionIds,
    value: optionId(value),
    onValueChange: (next) => {
      const match = filtered.find((entry) => optionId(entry.name) === next);
      if (match) onChange(match.name);
    },
  });

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
        />
        <Input
          id={id}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search icons…"
          // A more descriptive name than the field's visible "Icon" label; the
          // label still points here, so clicking it focuses the search box.
          aria-label="Search icons"
          className="pl-10 [&::-webkit-search-cancel-button]:cursor-pointer"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-6 text-center text-small text-muted-foreground">
          No icon matches “{query}”. Clear the search to see all {RESOLVED_CATEGORY_ICONS.length}.
        </p>
      ) : (
        <div
          id={gridId}
          role="radiogroup"
          aria-label="Category icon"
          onKeyDown={onKeyDown}
          className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto rounded-md border border-border bg-muted/40 p-2 sm:grid-cols-8"
        >
          {filtered.map(({ name, Icon }) => {
            const selected = name === value;
            return (
              <button
                key={name}
                ref={(node) => register(optionId(name), node)}
                type="button"
                role="radio"
                tabIndex={selected ? 0 : -1}
                aria-checked={selected}
                aria-label={name}
                title={name}
                onClick={() => onChange(name)}
                className={cn(
                  "grid aspect-square place-items-center rounded-md border transition-colors duration-150",
                  "focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none",
                  "hover:bg-surface",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}