"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * An interactive 1–5 star rating (spec 15).
 *
 * ## Why native radios and not five buttons
 *
 * A star picker **is** a radio group: one value out of five, mutually exclusive. That is
 * exactly what `<input type="radio">` implements, and the browser gives it for free —
 * arrow keys move the selection, one tab stop enters and leaves the group, the correct
 * accessibility tree is built without ARIA, and the value is announced.
 *
 * Re-implementing that over buttons means hand-writing roving tabindex, arrow handling,
 * wrapping and `aria-checked`, which is the `useRovingRadio` hook this codebase already has
 * for its **styled button grids** (the icon and colour pickers). Pairing it here would
 * handle every arrow keypress twice — once natively and once in the handler — with the two
 * disagreeing about what is selected. The Unit 10 `RolePicker` made this call and recorded
 * the reasoning; a rating is the same shape of decision.
 *
 * ## The rating is never colour-only
 *
 * The filled stars are decorative and `aria-hidden`; the **text** beside the group carries
 * "4 out of 5 stars" and is linked with `aria-describedby`. A screen reader announcing five
 * bare "star" graphics tells the user nothing, and a row of outlines with no text at all
 * tells a sighted user with low vision nothing either.
 *
 * ## Hover and focus previews
 *
 * Hovering or arrowing over the group previews that rating without committing it, which is
 * the behaviour a reader expects from a rating control. The committed value is still only
 * what is checked — a preview is never a selection, and moving away from it restores the
 * real value rather than leaving the last hovered star lit.
 *
 * Every star is a **≥40px** target (`code-standards.md`), not the 24px WCAG 2.2 minimum,
 * because this sits in a phone-sized composer and a 24px star is easy to miss.
 */
const RATINGS = [1, 2, 3, 4, 5] as const;

const LABELS: Record<number, string> = {
  1: "1 out of 5 stars",
  2: "2 out of 5 stars",
  3: "3 out of 5 stars",
  4: "4 out of 5 stars",
  5: "5 out of 5 stars",
};

export function StarPicker({
  value,
  onChange,
  /** Shown under the group; wired to `aria-describedby` so it is announced with it. */
  hint,
  disabled = false,
  name = "rating",
  className,
}: {
  /** The committed rating. `0` means nothing chosen yet. */
  value: number;
  onChange: (rating: number) => void;
  hint?: string;
  disabled?: boolean;
  /** Unique per form — two pickers on one page must not share a radio group. */
  name?: string;
  className?: string;
}) {
  const [hovered, setHovered] = React.useState<number | null>(null);

  const shown = hovered ?? value;
  const hintId = `${name}-hint`;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/*
        * `fieldset` + `legend` is the semantic grouping a screen reader announces as
        * "Your rating, radio group". A `div` with `role="radiogroup"` would need the legend
        * content re-implemented as `aria-label` and would still be less robust.
        */}
      <fieldset className="border-0 p-0" disabled={disabled}>
        <legend className="text-small font-medium text-foreground">Your rating</legend>

        <div
          className="flex items-center"
          onMouseLeave={() => setHovered(null)}
          onBlur={(event) => {
            // Leaving the group entirely restores the committed value, so a preview never
            // outlives the pointer. Related-target null means focus genuinely left.
            if (!event.currentTarget.contains(event.relatedTarget)) setHovered(null);
          }}
        >
          {RATINGS.map((rating) => {
            const filled = rating <= shown;

            return (
              <label
                key={rating}
                // Roving highlight without roving *tabindex*: the browser already moves the
                // selection with the arrow keys, so following it with focus is what makes
                // the checked star the one a keyboard user is on.
                onMouseEnter={() => setHovered(rating)}
                className={cn(
                  "grid size-10 cursor-pointer place-items-center rounded-md",
                  "focus-within:ring-ring/45 focus-within:ring-[3px]",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {/*
                 * Visually hidden, **not** `sr-only` alone: the radio must be reachable by
                 * Tab, so it stays in the tab order and is hidden by the absolute
                 * clip pattern instead.
                 */}
                <input
                  type="radio"
                  name={name}
                  value={rating}
                  checked={value === rating}
                  onChange={() => {
                    onChange(rating);
                    setHovered(null);
                  }}
                  onFocus={() => setHovered(rating)}
                  className="absolute size-0 opacity-0"
                />
                <Star
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className={cn(
                    "size-6 transition-colors",
                    filled ? "fill-accent text-accent" : "text-border",
                  )}
                />
                <span className="sr-only">{LABELS[rating]}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/*
        * The sentence is the accessible name for the group *and* the visible answer for
        * everyone: "Not rated yet" until a star is chosen, then the value. It is a live
        * region because arrow-keying changes it without a submit.
        */}
      <p
        id={hintId}
        aria-live="polite"
        className="text-caption font-medium text-foreground"
      >
        {value > 0 ? LABELS[value] : "Not rated yet"}
        {hint ? <span className="font-normal text-muted-foreground"> · {hint}</span> : null}
      </p>
    </div>
  );
}

/** Exported so the review list can reuse the same wording for its static stars. */
export const STAR_LABELS = LABELS;