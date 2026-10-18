"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import type { Variants } from "motion/react";
import { motionTokens, transitions } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * Scroll reveal: fade + 8px rise, once.
 *
 * **`viewport: { once: true, amount: 0 }` rather than a negative margin.** A negative margin
 * means the element has to be *fully* inside the viewport before it appears, which is right for
 * a person reading and wrong for anything else: a full-page screenshot, a print, or a reader who
 * jumps to the bottom all see blank cards, and an unrevealed section and a broken one look
 * identical. `amount: 0` reveals on the first pixel.
 *
 * **The variants are built per instance rather than taken from `useMotionVariants()`** because
 * the stagger delay has to live *inside* `visible.transition` — a `transition` prop on the
 * element would be merged with the variant's own transition and the delay would be applied to
 * the wrong thing. The durations and easing still come from `lib/motion.ts`; this file has no
 * timing of its own.
 *
 * Reduced motion keeps the opacity fade and drops the translate, so the content still arrives
 * rather than popping in fully opaque mid-read.
 */
export function Reveal({
  children,
  /** Seconds. Used to stagger a heading above the cards it introduces. */
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Rendered element. `section` for real landmarks, `li`/`p` inside a list or a paragraph. */
  as?: "div" | "section" | "li" | "article" | "p";
}) {
  const reduced = usePrefersReducedMotion();
  const Component = motion[as];

  const variants: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : motionTokens.distance.sm },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced
        ? transitions.fast
        : { ...transitions.slow, delay },
    },
  };

  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0 }}
      variants={variants}
    >
      {children}
    </Component>
  );
}