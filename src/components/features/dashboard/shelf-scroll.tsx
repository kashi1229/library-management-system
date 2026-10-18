"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A horizontal shelf with an edge fade that says there is more to the side.
 *
 * **Without it a row of three cards in a 1280px viewport reads as "three books", not as "a shelf
 * you can scroll".** The first version of the member dashboard had both shelves ending in dead
 * space with no affordance at all, so the recommendations looked complete.
 *
 * **The fade tracks the real scroll position**, which is the part that makes it honest rather
 * than decorative: it only appears on the side that has more content. A permanent right-edge fade
 * over a shelf that happens to fit is a small lie, and it is the kind of small lie that makes
 * people scroll a list that does not move.
 *
 * **State comes from an event listener, never from `setState` in an effect body** — this
 * codebase treats React 19's `react-hooks/set-state-in-effect` as a real defect, and a resize or
 * scroll handler is exactly the case where setting state is correct.
 */
export function ShelfScroll({
  label,
  className,
  itemClassName,
  children,
}: {
  /** Becomes the track's `aria-label`, so a screen reader hears "Recommended for you" and not
   *  a run of filenames. */
  label: string;
  className?: string;
  /** Width of one item, so the "next" peek is deliberate rather than whatever falls out. */
  itemClassName?: string;
  children: React.ReactNode;
}) {
  const trackRef = React.useRef<HTMLUListElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const max = track.scrollWidth - track.clientWidth;
      // `scrollLeft` is negative in RTL and positive in LTR; one abs() covers both. The 4px
      // tolerance is because a sub-pixel snap can leave the track a pixel or two off zero, and a
      // fade that appears on a shelf that has not been touched reads as a rendering fault.
      const at = Math.abs(track.scrollLeft);
      setEdges({ left: at > 4, right: at < max - 4 });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(track);
    for (const child of Array.from(track.children)) observer.observe(child);

    track.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", measure);
    };
  }, []);

  return (
    <div className={cn("relative -mx-4 sm:-mx-6 lg:-mx-8", className)}>
      {/* Negative side padding so the first tile aligns with the page gutter while the row still
          bleeds to the edge — a shelf whose first card is inset by its own scroll padding reads
          as misaligned rather than as a scroller. */}
      <ul
        ref={trackRef}
        role="list"
        aria-label={label}
        className="flex snap-x snap-proximity gap-4 overflow-x-auto px-4 pb-2 sm:px-6 lg:px-8"
      >
        {React.Children.map(children, (child) => (
          <li key={React.isValidElement(child) && child.key ? child.key : undefined} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>

      {/*
       * **The fades are pinned to the wrapper, which carries the same negative margin as the
       * track** — not to the track itself. They were originally on an un-margined wrapper, which
       * put the left fade 16px *inside* the first card: the first cover on the member dashboard
       * rendered visibly washed out, and the right fade sat over the last card's countdown ring.
       * An affordance that dims the thing it is advertising is worse than no affordance.
       *
       * `pointer-events-none` so the fade never eats a drag or a click on the card beneath it.
       */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-12 bg-linear-to-r from-background to-transparent transition-opacity duration-200",
          edges.left ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-12 bg-linear-to-l from-background to-transparent transition-opacity duration-200",
          edges.right ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}