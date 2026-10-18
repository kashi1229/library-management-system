"use client";

import * as React from "react";
import { animate, useInView } from "motion/react";
import { springs } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * Counts 0 → `value` once when it scrolls into view.
 *
 * **Extracted from `StatCard` rather than copied into the landing page's stats band.** Two
 * copies of a count-up are two copies of its hydration rule, and that rule is the whole reason
 * the component exists: the rendered number starts at `value`, not at `0`, so the server HTML
 * and the first client frame agree and a reader never sees a zero-flash on a figure the database
 * already knows.
 *
 * Until the animation runs the rendered number always mirrors the `value` prop, so a data
 * refresh can never leave a stale count on screen — and if the component scrolls out of view
 * before it starts, it simply never counts, which is the correct outcome for a figure nobody
 * looked at.
 */
export function CountUp({
  value,
  format,
  className,
  /** Start the count as soon as any part is visible. */
  amount = 0,
}: {
  value: number;
  /**
   * How to render the number. **Optional, and the default is the one a count wants.**
   *
   * It is optional so a Server Component can use `CountUp` directly. React refuses to serialise
   * a function across the RSC boundary, so a Server Component passing
   * `format={(n) => …}` gets *"Functions cannot be passed directly to Client Components"* and
   * the page throws — the same failure Unit 17 hit passing an `icon` component to `StatCard`.
   * A Server Component wanting a custom format has to render the number itself.
   */
  format?: (value: number) => string;
  className?: string;
  amount?: number | "some" | "all";
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount });
  const reduced = usePrefersReducedMotion();
  const [animated, setAnimated] = React.useState(value);

  const render = format ?? ((n: number) => n.toLocaleString("en-US"));
  const running = inView && !reduced;

  React.useEffect(() => {
    if (!running) return;

    const controls = animate(0, value, {
      ...springs.gentle,
      damping: 26,
      // setState fires from the animation frame callback, not the effect body —
      // `react-hooks/set-state-in-effect` is treated as a real defect in this codebase.
      onUpdate: (latest) => setAnimated(Math.round(latest)),
      onComplete: () => setAnimated(value),
    });

    return () => controls.stop();
  }, [running, value]);

  return (
    <span ref={ref} className={className}>
      {render(running ? animated : value)}
    </span>
  );
}