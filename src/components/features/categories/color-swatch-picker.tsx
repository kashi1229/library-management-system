"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRovingRadio } from "@/hooks/use-roving-radio";
import { CATEGORY_COLORS, CATEGORY_COLOR_CLASS, type CategoryColor } from "@/lib/constants";

/** Human labels for the six category accents (ui-context.md). */
export const CATEGORY_COLOR_LABELS: Record<CategoryColor, string> = {
  forest: "Forest",
  terracotta: "Terracotta",
  ocean: "Ocean",
  plum: "Plum",
  ochre: "Ochre",
  slate: "Slate",
};

/**
 * The six category accents as radio swatches (ui-context.md).
 *
 * Each swatch is a real button and therefore a labelable element, so the
 * surrounding `Field` label points at the *selected* one — clicking the label
 * lands on the current choice instead of dead-ending.
 *
 * Arrow keys cycle the swatches (`useRovingRadio`), and a tick marks the
 * selection so it does not rely on colour alone.
 */
export function ColorSwatchPicker({
  value,
  onChange,
  id,
  className,
}: {
  value: CategoryColor;
  onChange: (color: CategoryColor) => void;
  /** Base id; the selected swatch becomes `${id}-${value}` and receives the label. */
  id: string;
  className?: string;
}) {
  const optionId = React.useCallback((color: CategoryColor) => `${id}-${color}`, [id]);
  const optionIds = React.useMemo(() => CATEGORY_COLORS.map(optionId), [optionId]);

  const { register, onKeyDown } = useRovingRadio({
    ids: optionIds,
    value: optionId(value),
    onValueChange: (next) => {
      const match = CATEGORY_COLORS.find((color) => optionId(color) === next);
      if (match) onChange(match);
    },
  });

  return (
    <div
      role="radiogroup"
      aria-label="Accent colour"
      onKeyDown={onKeyDown}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {CATEGORY_COLORS.map((color) => {
        const selected = color === value;
        const label = CATEGORY_COLOR_LABELS[color];
        const swatch = CATEGORY_COLOR_CLASS[color];

        return (
          <button
            key={color}
            ref={(node) => register(optionId(color), node)}
            id={optionId(color)}
            type="button"
            role="radio"
            tabIndex={selected ? 0 : -1}
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => onChange(color)}
            className={cn(
              "relative grid size-11 shrink-0 place-items-center rounded-md border-2",
              "transition-[border-color,transform] duration-150",
              "focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none",
              "hover:scale-105 active:scale-100 motion-reduce:hover:scale-100",
              swatch.bg,
              // The tick uses the theme-independent ink for that accent, which
              // is only readable on the swatch in both themes.
              swatch.on,
              selected ? "border-foreground" : "border-transparent",
            )}
          >
            {selected ? <Check className="size-5" strokeWidth={2.5} aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}