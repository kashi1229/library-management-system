"use client";

import { useSyncExternalStore } from "react";
import { CATEGORY_COLORS, type CategoryColor } from "@/lib/constants";

/**
 * Chart colours, read from the live CSS custom properties.
 *
 * **Recharts needs colour *values*, not class names.** Every other surface in this app colours
 * itself with a token class (`bg-primary`, `text-accent-ink`) and lets the cascade resolve it —
 * SVG `fill`/`stroke` cannot take a class, so a chart handed `fill="bg-primary"` paints nothing.
 * The alternative, hardcoding hexes in the chart, is forbidden by `ui-context.md` and would be
 * wrong twice: the light value would leak into dark mode, and the two would drift from
 * `globals.css` the first time a token was retuned.
 *
 * **`getComputedStyle`, per `globals.css`, is the only place the real value exists.** It resolves
 * whatever the cascade produced, so a chart and a card drawn side by side are the same colour by
 * construction.
 *
 * Built on `useSyncExternalStore` rather than `useEffect` + `setState`, for two reasons:
 *  - React 19's `react-hooks/set-state-in-effect` rule, which this codebase treats as a real
 *    defect rather than noise (see `ui-context.md` §Hydration Rules);
 *  - `getServerSnapshot` returning `null` is what makes hydration correct. The server cannot
 *    measure the cascade, so the first client render *also* sees `null` and renders the
 *    skeleton; React swaps in the real tokens on the following frame, by which rule, with no
 *    mismatch warning. The skeleton is given the chart's exact height so nothing shifts.
 *
 * **Subscription is a class mutation on `<html>`,** which is precisely how `next-themes` applies
 * a theme — including `system`, where it writes the *resolved* class when the OS setting flips.
 * Watching `style` as well catches the `color-scheme` it sets alongside.
 */
export type ChartTokens = {
  /** Area/line strokes and the active nav colour. */
  primary: string;
  /** The second gradient stop — warm against `primary`, so the fill reads as a wash. */
  accent: string;
  /** Grid lines and axis rules. */
  border: string;
  /** Tick labels; a tick that cannot be read is not a tick. */
  mutedForeground: string;
  /** Tooltip surface and its text. */
  surface: string;
  foreground: string;
  /**
   * One entry per `CategoryColor`, in `CATEGORY_COLORS` order.
   *
   * **Indexed by the stored colour name, not by position**, so a donut slice cannot drift when
   * a category is reordered or a hue is renamed. The hues themselves are fixed in `:root` and
   * never flipped per theme (`ui-context.md`), so this half of the map is theme-independent —
   * which is correct: a category's colour is its identity, and it must not change at night.
   */
  categories: Record<CategoryColor, string>;
};

/** CSS custom property name for each fixed category hue. */
const CATEGORY_VAR: Record<CategoryColor, string> = {
  forest: "--cat-forest",
  terracotta: "--cat-terracotta",
  ocean: "--cat-ocean",
  plum: "--cat-plum",
  ochre: "--cat-ochre",
  slate: "--cat-slate",
};

/**
 * Fallbacks, used only if a variable is somehow missing.
 *
 * These are the **light** palette values, so a chart can never fail to paint. They are not a
 * second source of truth for colour: the only way one can be reached is an unregistered custom
 * property, which is a build error rather than a design state.
 */
const FALLBACK: Omit<ChartTokens, "categories"> = {
  primary: "#1f3d36",
  accent: "#c2703d",
  border: "#e6dfd3",
  mutedForeground: "#6b645a",
  surface: "#ffffff",
  foreground: "#1c1917",
};

const FALLBACK_CATEGORY: Record<CategoryColor, string> = {
  forest: "#1f3d36",
  terracotta: "#c2703d",
  ocean: "#3b6e8f",
  plum: "#6b3e5e",
  ochre: "#c98a1b",
  slate: "#4a5560",
};

/** Cache key: the `<html>` class and inline style, which together identify the active theme. */
let cache: { key: string; value: ChartTokens } | null = null;

function readTokens(): ChartTokens {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;

  const categories = {} as Record<CategoryColor, string>;
  for (const name of CATEGORY_COLORS) {
    categories[name] = read(CATEGORY_VAR[name], FALLBACK_CATEGORY[name]);
  }

  return {
    primary: read("--primary", FALLBACK.primary),
    accent: read("--accent", FALLBACK.accent),
    border: read("--border", FALLBACK.border),
    mutedForeground: read("--muted-foreground", FALLBACK.mutedForeground),
    surface: read("--surface", FALLBACK.surface),
    foreground: read("--foreground", FALLBACK.foreground),
    categories,
  };
}

/**
 * **The snapshot is cached against the theme key.** `useSyncExternalStore` re-reads the snapshot
 * on every render and compares with `Object.is`; returning a freshly built object each time
 * would report a change on every render and spin React forever. Rebuilding only when the class
 * changes keeps the identity stable between ordinary renders.
 */
function getSnapshot(): ChartTokens {
  const root = document.documentElement;
  const key = `${root.className}|${root.style.colorScheme}`;

  if (cache && cache.key === key) return cache.value;

  const value = readTokens();
  cache = { key, value };
  return value;
}

/** The server cannot measure the cascade. `null` renders the skeleton, not a wrong colour. */
function getServerSnapshot(): null {
  return null;
}

function subscribe(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });

  return () => observer.disconnect();
}

/**
 * Live chart colours, or `null` before the client has taken over.
 *
 * `null` means "not measured yet", never "no theme" — a caller must render a same-size skeleton
 * rather than treat it as an empty chart, or the page would flash "No loans yet" at a member who
 * does have loans.
 */
export function useChartTokens(): ChartTokens | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * The category hue for a donut slice, as a real colour value.
 *
 * Takes the raw string from the API rather than a `CategoryColor`, because the wire type is a
 * `string` and an unknown value has to have an answer — a category saved before a hue was added,
 * or one written by a fixture. It degrades to `forest`, the documented default, rather than
 * painting `undefined` and leaving a slice invisible.
 */
export function categoryColorValue(tokens: ChartTokens, color: string | null | undefined): string {
  return tokens.categories[(color as CategoryColor) in tokens.categories ? (color as CategoryColor) : "forest"];
}