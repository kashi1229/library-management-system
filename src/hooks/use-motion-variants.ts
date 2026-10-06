"use client";

import { useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";
import {
  fadeUp,
  fadeUpReduced,
  scaleIn,
  scaleInReduced,
  slideIn,
  slideInReduced,
  stagger,
  staggerReduced,
} from "@/lib/motion";
import type { Variants } from "motion/react";

export type MotionVariantSet = {
  fadeUp: Variants;
  stagger: Variants;
  scaleIn: Variants;
  slideIn: Variants;
};

const FULL_MOTION: MotionVariantSet = { fadeUp, stagger, scaleIn, slideIn };
const REDUCED_MOTION: MotionVariantSet = {
  fadeUp: fadeUpReduced,
  stagger: staggerReduced,
  scaleIn: scaleInReduced,
  slideIn: slideInReduced,
};

/**
 * Hydration-safe "am I on the client yet" flag.
 *
 * Built on `useSyncExternalStore` so there is no `setState`-in-effect render
 * cascade: the server snapshot is `false`, the client snapshot is `true`, and
 * React swaps them in without a cascading render.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * `true` only when the user has asked for reduced motion **and** the client has
 * taken over from the server render.
 *
 * `useReducedMotion()` returns `null` during SSR, but resolves to the real media
 * query value on the **first client frame** — so reading it alone lets the variant
 * set differ between the server HTML and the hydrated tree, and React reports:
 *
 *   A tree hydrated but some attributes of the server rendered HTML didn't match
 *   the client properties.
 *
 * Folding in `useIsHydrated()` pins the first client render to the server snapshot,
 * which makes the markup byte-identical. The swap happens one render later, which is
 * the same one-frame cost `ui-context.md` already accepts for
 * `useSyncExternalStore`-driven values.
 */
export function usePrefersReducedMotion(): boolean {
  const prefers = useReducedMotion() === true;
  const hydrated = useIsHydrated();
  return hydrated && prefers;
}

/**
 * Reduced-motion aware variants for the shared motion language in `lib/motion.ts`.
 * Consumers must keep `initial="hidden"` so the server renders the same hidden
 * state the client hydrates from.
 */
export function useMotionVariants(): MotionVariantSet & { reduced: boolean } {
  const reduced = usePrefersReducedMotion();
  return { ...(reduced ? REDUCED_MOTION : FULL_MOTION), reduced };
}

/** No external store to watch — the snapshot alone drives the flag. */
function subscribeToNothing(): () => void {
  return () => undefined;
}
