"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

/** The five presets the spec names, as `days` back from today; `null` means "custom". */
const PRESETS = [
  { value: "7d", label: "7d", days: 6 },
  { value: "30d", label: "30d", days: 29 },
  { value: "90d", label: "90d", days: 89 },
  { value: "year", label: "This year", days: null },
  { value: "custom", label: "Custom", days: null },
] as const satisfies ReadonlyArray<{ value: string; label: string; days: number | null }>;

export type RangePresetValue = (typeof PRESETS)[number]["value"];

/**
 * `YYYY-MM-DD` for the Nth day back, or `null` for an open end.
 *
 * **`format(date, "yyyy-MM-dd")`, never `date.toISOString().slice(0, 10)`.** `toISOString`
 * converts to **UTC**, so at 20:00 in a negative-offset timezone "today" becomes *tomorrow* — and
 * the report then silently includes a day that has not happened. Formatting the local calendar
 * fields is the only way to get the day the user is looking at. (The server reads these bounds
 * back as UTC day edges; that half is deliberate and documented there.)
 */
function dayOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return format(date, "yyyy-MM-dd");
}

function startOfThisYear(): string {
  return format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd");
}

/**
 * Work out which preset, if any, the current `from`/`to` pair corresponds to.
 *
 * **Derived from the values, not stored alongside them.** A URL can arrive from anywhere — a
 * shared link, a reload, the Back button — so a separate `preset` parameter could disagree with
 * the dates it claims to describe. Deriving means the highlighted chip and the range can never
 * contradict each other, and an unrecognised range simply shows no chip rather than a wrong one.
 */
function detectPreset(from: string, to: string): RangePresetValue | null {
  if (!from && !to) return "30d";
  const today = dayOffset(0);
  if (to !== today) return null;

  for (const preset of PRESETS) {
    if (preset.days === null) continue;
    if (from === dayOffset(preset.days)) return preset.value;
  }
  if (from === startOfThisYear()) return "year";
  return "custom";
}

/**
 * The report filter bar: a date range with presets, plus a custom range when asked for.
 *
 * **The presets `push` history and the custom inputs `replace` it.** Picking "30d" is a discrete
 * decision and Back should undo it; typing a date is typing, and six history entries to get out
 * of a mistyped year is the behaviour `ui-context.md` §Filter bar warns about.
 *
 * **Changing either end resets the page**, because page 4 of the old range is not page 4 of the
 * new one — see `useReportFilters`.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (next: { from?: string; to?: string }) => void;
}) {
  const [custom, setCustom] = React.useState(false);
  const preset = detectPreset(from, to);
  const [localFrom, setLocalFrom] = React.useState(from);
  const [localTo, setLocalTo] = React.useState(to);
  const [error, setError] = React.useState<string | null>(null);

  // Keep the local inputs in step when the URL changes underneath us (Back, a shared link, the
  // reset button) — but not while the user is mid-edit, which is what `custom` distinguishes.
  //
  // **A render-phase sync, not an effect.** `react-hooks/set-state-in-effect` is treated as a real
  // defect in this codebase (see `ui-context.md` §Hydration Rules), and this is the documented
  // replacement: React's "adjusting state when props change" pattern, exactly as
  // `use-loan-filters.ts` does with its search draft. An effect would paint the stale input for a
  // frame first, so somebody clicking Back would see the old date, then the new one.
  if (!custom && (localFrom !== from || localTo !== to)) {
    setLocalFrom(from);
    setLocalTo(to);
  }

  function applyPreset(value: RangePresetValue) {
    if (value === "custom") {
      setCustom(true);
      return;
    }
    setCustom(false);
    onChange({ from: value === "year" ? startOfThisYear() : dayOffset(PRESETS.find((p) => p.value === value)!.days!), to: dayOffset(0) });
  }

  function applyCustom() {
    // Checked here rather than in the validator so the message lands beside the inputs, instead
    // of arriving as a 422 banner above the table after a round trip.
    if (localFrom && localTo && localFrom > localTo) {
      setError("The start date must be on or before the end date.");
      return;
    }
    setError(null);
    onChange({ from: localFrom || undefined, to: localTo || undefined });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
        <div
          role="group"
          aria-label="Date range"
          className="flex flex-wrap gap-1.5 rounded-md bg-muted p-1"
        >
          {PRESETS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={preset === option.value || (custom && option.value === "custom") ? "default" : "ghost"}
              aria-pressed={preset === option.value || (custom && option.value === "custom")}
              onClick={() => applyPreset(option.value as RangePresetValue)}
              className={cn(
                option.value === "custom" && "hidden sm:inline-flex",
                "h-9 px-3",
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* `sm:grid-cols-2` so the two inputs sit side by side from tablet up and stack below —
          at 360px two date inputs on one row cannot both show their full value. */}
      <div className={cn("grid gap-3", custom ? "sm:grid-cols-[1fr_1fr_auto] sm:items-end" : "hidden")}>
        <Field label="From" error={error && localFrom ? error : undefined}>
          <Input
            id="range-from"
            type="date"
            value={localFrom}
            max={localTo || undefined}
            onChange={(event) => setLocalFrom(event.target.value)}
          />
        </Field>
        <Field label="To" error={error && !localFrom ? error : undefined}>
          <Input
            id="range-to"
            type="date"
            value={localTo}
            min={localFrom || undefined}
            onChange={(event) => setLocalTo(event.target.value)}
          />
        </Field>
        <Button type="button" onClick={applyCustom} className="h-11">
          Apply
        </Button>
      </div>
    </div>
  );
}