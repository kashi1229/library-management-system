"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { springs } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * A hairline reading-progress bar pinned to the top of the viewport.
 *
 * **Only on the landing page.** It is a page-length affordance, and a reader inside the app is
 * looking at a dashboard or a form where "how far through the document am I" is not a question
 * they have.
 *
 * **`useScroll` + `useSpring`, not a scroll listener.** The scale is derived from scroll state
 * rather than assigned in an event handler, so there is no `setState` per scroll frame and the
 * bar stays perfectly smooth even when the main thread is busy.
 *
 * **Under reduced motion the bar is simply absent.** It is the only thing on the page whose
 * entire purpose is motion; a static version of it would be a decorative rule with a progress
 * reading, which is worse than no bar.
 */
export function ScrollProgress() {
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, springs.instant);

  if (reduced) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-accent"
      style={{ scaleX }}
    />
  );
}