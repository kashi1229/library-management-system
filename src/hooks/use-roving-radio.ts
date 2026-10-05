"use client";

import * as React from "react";

/**
 * Roving-tabindex keyboard support for an ARIA `radiogroup` (WAI-ARIA APG).
 *
 * `role="radio"` promises the user that the arrow keys move between options and
 * that only the checked option sits in the tab order. Native radios do this for
 * free; a grid of styled buttons does not, so this hook supplies the missing
 * behaviour and keeps it in one place instead of re-implementing it in every
 * picker.
 *
 * Home/End jump to the first/last option and the arrows wrap at the edges,
 * matching a native single-select group.
 */
export function useRovingRadio({
  ids,
  value,
  onValueChange,
}: {
  /** Stable ids, index-aligned with the rendered options, in visual order. */
  ids: readonly string[];
  /** Id of the selected option. */
  value: string;
  onValueChange: (next: string) => void;
}) {
  // Resolved DOM nodes for the options. Written from the callback ref during
  // commit and read only from event handlers, never during render.
  const nodes = React.useRef(new Map<string, HTMLElement>());

  const register = React.useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  const focusOption = React.useCallback((id: string) => {
    nodes.current.get(id)?.focus();
  }, []);

  const move = React.useCallback(
    (step: number) => {
      if (ids.length === 0) return;
      const current = ids.indexOf(value);
      const from = current === -1 ? 0 : current;
      const next = ids[(from + step + ids.length) % ids.length];
      onValueChange(next);
      focusOption(next);
    },
    [focusOption, ids, onValueChange, value],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          move(1);
          return;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          move(-1);
          return;
        case "Home":
          event.preventDefault();
          onValueChange(ids[0]);
          focusOption(ids[0]);
          return;
        case "End": {
          event.preventDefault();
          const last = ids[ids.length - 1];
          onValueChange(last);
          focusOption(last);
          return;
        }
        default:
      }
    },
    [focusOption, ids, move, onValueChange],
  );

  return { register, focusOption, onKeyDown };
}