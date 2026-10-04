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
 * `true` only when the user has asked for reduced motion.
 *
 * `useReducedMotion()` returns `null` during SSR and on the first client frame,
 * so both render `false` — server and client markup always agree. Once resolved,
 * the transform-free variant set takes over.
 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() === true;
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
