"use client";

import * as React from "react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { transitions } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * The bulk-action bar for the staff book table (spec 08).
 *
 * It slides up from below the fold only while a selection exists, and it is
 * `position: fixed` so a long table cannot push it out of reach — the same
 * reachability trap the Unit 07 dialog hit.
 *
 * **It never unmounts the trigger button.** A `position: fixed` bar with a
 * destructive action is a small target; the `aria-live` count plus `Escape` to
 * clear gives a keyboard user an equally fast way out.
 */
export function BulkBar({
  count,
  onArchive,
  onClear,
  pending = false,
  className,
}: {
  count: number;
  onArchive: () => void;
  onClear: () => void;
  pending?: boolean;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const pathname = usePathname();

  // Escape anywhere clears the selection, so a keyboard user is never trapped by
  // an invisible bar.
  React.useEffect(() => {
    if (count === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, onClear]);

  // Route changes drop the selection: an id from the previous page must never be
  // carried into a bulk action on a different one.
  React.useEffect(() => {
    onClear();
    // `onClear` is intentionally omitted: including it would re-run on every
    // render of the parent and clear a fresh selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const active = count > 0;

  return (
    <motion.div
      // Kept mounted in both states; only `pointer-events` and visibility change.
      initial={false}
      animate={active ? { y: 0, opacity: 1 } : { y: reduced ? 0 : 120, opacity: 0 }}
      transition={reduced ? { duration: 0.15 } : transitions.base}
      aria-hidden={!active}
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4",
        "md:pb-6",
        active && "pointer-events-auto",
        className,
      )}
    >
      <div
        role="region"
        aria-label="Bulk actions"
        className={cn(
          "flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3",
          "shadow-lift",
          // Safe-area padding for notched phones.
          "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        )}
      >
        <p className="me-auto text-small text-foreground">
          <span className="font-semibold">{count}</span>{" "}
          {count === 1 ? "book" : "books"} selected
        </p>

        <Button variant="ghost" onClick={onClear} disabled={pending} className="text-muted-foreground">
          <X className="size-4" aria-hidden="true" />
          Clear
        </Button>

        <Button onClick={onArchive} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Archiving…
            </>
          ) : (
            "Archive selected"
          )}
        </Button>

        {/* Announces the selection and the pending state without moving focus. */}
        <span aria-live="polite" role="status" className="sr-only">
          {count} {count === 1 ? "book" : "books"} selected
          {pending ? ", archiving" : ""}
        </span>
      </div>
    </motion.div>
  );
}
