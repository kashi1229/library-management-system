"use client";

import { motion, useReducedMotion } from "motion/react";
import { CATEGORY_COLORS, CATEGORY_COLOR_CLASS, type CategoryColor } from "@/lib/constants";

/**
 * Softly drifting book spines, built entirely from CSS shapes.
 *
 * Each spine is a rounded bar tinted with a category accent. They drift on slow,
 * offset sine cycles — transform only, no layout properties — and the animation
 * is skipped entirely when the user prefers reduced motion.
 */

/** Deliberately uneven widths/heights so the row reads as books, not a bar chart. */
const SPINES: { color: CategoryColor; height: number; width: number; lift: number }[] = [
  { color: "terracotta", height: 116, width: 20, lift: 10 },
  { color: "ochre", height: 140, width: 16, lift: 26 },
  { color: "forest", height: 100, width: 24, lift: 4 },
  { color: "ocean", height: 132, width: 18, lift: 18 },
  { color: "plum", height: 108, width: 22, lift: 30 },
  { color: "slate", height: 124, width: 15, lift: 12 },
  { color: "terracotta", height: 92, width: 19, lift: 24 },
  { color: "ocean", height: 136, width: 17, lift: 6 },
  { color: "ochre", height: 104, width: 23, lift: 22 },
  { color: "plum", height: 128, width: 16, lift: 14 },
];

export function BookSpines({ className }: { className?: string }) {
  const reduced = useReducedMotion() === true;

  return (
    <div
      className={className}
      style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: 150 }}
      data-motion-transform={reduced ? undefined : "true"}
    >
      {SPINES.map((spine, index) => {
        const tone = CATEGORY_COLOR_CLASS[spine.color];

        return (
          <motion.span
            key={`${spine.color}-${index}`}
            className={`${tone.bg} relative block shrink-0 rounded-t-[3px] rounded-b-[2px]`}
            style={{ height: spine.height, width: spine.width }}
            animate={
              reduced
                ? undefined
                : { y: [spine.lift, -spine.lift, spine.lift], rotate: [0, index % 2 === 0 ? 0.6 : -0.6, 0] }
            }
            transition={
              reduced
                ? undefined
                : {
                    duration: 9 + (index % 4) * 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    // Offset phases so the row never pulses in unison.
                    delay: index * 0.55,
                  }
            }
          >
            {/* Spine highlight + two title bands, so each spine reads as a book. */}
            <span className="absolute inset-y-0 left-0 w-[3px] rounded-tl-[3px] bg-primary-foreground/25" />
            <span className="absolute inset-x-1 top-4 h-px bg-primary-foreground/35" />
            <span className="absolute inset-x-1 top-7 h-px bg-primary-foreground/20" />
          </motion.span>
        );
      })}
    </div>
  );
}

export { CATEGORY_COLORS };
