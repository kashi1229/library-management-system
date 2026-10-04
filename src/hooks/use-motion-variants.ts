"use client";

import { useEffect, useState } from "react";
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
 * Reduced-motion aware variant set.
 *
 * `mounted` is false on the server and on the very first client render, so the
 * caller must render the full-motion variants initially — that keeps the server
 * markup and the first client frame identical (no hydration mismatch). Once
 * mounted we can safely swap in the transform-free variants.
 */
export function useMotionVariants(): MotionVariantSet & {
  reduced: boolean;
  mounted: boolean;
} {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const reduced = mounted && prefersReduced === true;

  return { ...(reduced ? REDUCED_MOTION : FULL_MOTION), reduced, mounted };
}

/** Plain boolean flag for hand-rolled animations (hero drift, count-ups). */
export function usePrefersReducedMotion(): boolean {
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted && prefersReduced === true;
}
