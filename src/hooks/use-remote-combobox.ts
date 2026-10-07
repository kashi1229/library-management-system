"use client";

import * as React from "react";

/**
 * Debounced, abortable remote search with combobox keyboard support (spec 12).
 *
 * The circulation desk needs this twice — member lookup and book search — and the
 * interesting parts are all easy to get subtly wrong:
 *
 * - **Abort the previous request.** Without it, a slow response for `"gr"` lands after a
 *   fast one for `"grace"` and the list shows the older, less relevant rows. Two overlapping
 *   timers is the classic version of this bug.
 * - **No `setState` synchronously in the effect body.** React 19's
 *   `react-hooks/set-state-in-effect` rule forbids it, and it is right to: the effect runs
 *   *after* paint, so the UI would briefly show results for a term the user has already
 *   moved past. Visibility is **derived** below instead.
 * - **Minimum query length.** Firing on one character sends a query matching most of the
 *   collection and a list nobody can use.
 * - **One "chosen" path.** Clearing the list lives here rather than in each consumer,
 *   because a consumer that resets on click but forgets on Enter leaves a full list under
 *   an empty input.
 *
 * Results are stored **keyed by the term that produced them**, and the visible list is
 * derived by comparing that key with the current term. That removes every synchronous
 * `setState` from the effect while guaranteeing the list can never show results for a
 * stale query.
 */
export function useRemoteCombobox<T>({
  query,
  onChoose,
  minLength = 2,
  debounceMs = 250,
}: {
  query: (term: string, signal: AbortSignal) => Promise<T[]>;
  /** Called for a row chosen by click **or** by Enter. */
  onChoose: (item: T) => void;
  minLength?: number;
  debounceMs?: number;
}) {
  const [term, setTerm] = React.useState("");
  const [open, setOpen] = React.useState(false);

  /** Results plus the exact term that produced them. */
  const [state, setState] = React.useState<{ term: string; items: T[] }>({
    term: "",
    items: [],
  });

  const [highlighted, setHighlighted] = React.useState(0);

  // Held in a ref so the cleanup can abort the in-flight request without re-running the
  // effect, which would restart the search on every render.
  const controllerRef = React.useRef<AbortController | null>(null);

  const trimmed = term.trim();
  const longEnough = trimmed.length >= minLength;

  /*
   * Derived, not assigned. `items` is only shown when it belongs to the term currently in
   * the box, so typing another character hides the stale list immediately — no flash, and
   * no effect-driven state write.
   *
   * Memoised because `onKeyDown` depends on it, and an unmemoised array literal would be a
   * new reference every render, rebuilding the handler for every consumer.
   */
  const items: T[] = React.useMemo(
    () => (longEnough && state.term === trimmed ? state.items : []),
    [longEnough, state.term, trimmed, state.items],
  );

  const loading = longEnough && state.term !== trimmed;

  React.useEffect(() => {
    if (!longEnough) return;

    const controller = new AbortController();
    controllerRef.current = controller;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const found = await query(trimmed, controller.signal);
          // The request that finishes last is not necessarily the one that started last,
          // so only the current controller's result may be written.
          if (controllerRef.current === controller) setState({ term: trimmed, items: found });
        } catch {
          if (controllerRef.current === controller) setState({ term: trimmed, items: [] });
        }
      })();
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // `query` is intentionally excluded: callers pass an inline arrow, which is a new
    // reference every render and would restart the search on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed, longEnough, debounceMs]);

  React.useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  /*
   * A shorter result list must not leave the highlight pointing past its end, or Enter
   * would do nothing on a row that is visibly highlighted but does not exist.
   *
   * **Derived, not corrected in an effect** — so the list can never even paint an
   * out-of-range highlight, and no `setState` is needed.
   */
  const active = highlighted > items.length - 1 ? 0 : highlighted;

  const reset = React.useCallback(() => {
    setTerm("");
    setOpen(false);
    setHighlighted(0);
    setState({ term: "", items: [] });
  }, []);

  /*
   * The latest `onChoose`, for the keyboard handler only.
   *
   * The ref is **written in an effect and read in an event handler**, which is the rule:
   * writing it during render is a render-phase ref mutation, and reading it during render
   * lets the component disagree with itself. `react-hooks/refs` flags both.
   */
  const onChooseRef = React.useRef(onChoose);
  React.useEffect(() => {
    onChooseRef.current = onChoose;
  }, [onChoose]);

  const choose = React.useCallback(
    (item: T) => {
      onChooseRef.current(item);
      reset();
    },
    [reset],
  );

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (!open || items.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlighted((i) => (i + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlighted((i) => (i - 1 + items.length) % items.length);
      } else if (event.key === "Enter") {
        // `preventDefault` because these comboboxes sit in a form-less panel, so an
        // unhandled Enter would otherwise do nothing at all.
        event.preventDefault();
        const picked = items[active];
        if (picked) choose(picked);
      }
    },
    [open, items, active, choose],
  );

  return {
    term,
    setTerm: (value: string) => {
      setTerm(value);
      setOpen(true);
    },
    open,
    setOpen,
    items,
    loading,
    /** Index of the row Enter would choose, clamped to the current list. */
    highlighted: active,
    setHighlighted,
    /** Nothing to search for yet — a hint line, not a spinner. */
    tooShort: !longEnough && term.length > 0,
    onKeyDown,
    /** Call from a row's click handler. */
    choose,
    reset,
  };
}