"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Long description with a "read more" toggle.
 *
 * Descriptions vary from one line to 2000 characters. Rather than clamping to a
 * guessed height and hiding the overflow — which produces an awkward mid-sentence
 * cut — the text is **fully rendered and measured**, and the fade plus button appear
 * only when it actually overflows.
 *
 * The measurement happens on layout, not in an effect, so there is no frame where the
 * full text flashes in before the fade appears.
 */
export function ReadMore({
  text,
  collapsedLines = 6,
  className,
}: {
  text: string;
  /** Lines shown before the toggle appears. */
  collapsedLines?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const measure = React.useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    // `scrollHeight > clientHeight` only means something while clamped, so measure
    // in the collapsed state regardless of the current toggle.
    const wasExpanded = expanded;
    if (wasExpanded) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [expanded]);

  React.useLayoutEffect(measure, [measure, text]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative">
        <div
          ref={bodyRef}
          className={cn(
            "text-body text-pretty text-muted-foreground transition-[max-height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            !expanded && "overflow-hidden",
          )}
          style={
            expanded
              ? undefined
              : { maxHeight: `${collapsedLines * 1.65}em`, display: "-webkit-box", WebkitBoxOrient: "vertical" }
          }
        >
          {text}
        </div>

        {/* Fade only while collapsed and actually overflowing. */}
        {!expanded && overflows ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-surface to-transparent"
          />
        ) : null}
      </div>

      {overflows ? (
        <ButtonLike expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
      ) : null}
    </div>
  );
}

function ButtonLike({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="inline-flex min-h-9 items-center rounded-md text-small font-medium text-accent-ink underline-offset-4 transition-colors hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
    >
      {expanded ? "Show less" : "Read more"}
    </button>
  );
}