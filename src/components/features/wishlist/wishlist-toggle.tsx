"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { springs } from "@/lib/motion";
import { toErrorMessage, wishlistApi } from "@/lib/api-client";

/**
 * The wishlist heart (F10, spec 15).
 *
 * ## Optimistic, and rolled back
 *
 * The heart flips **immediately** and the request follows. A save is a member's most
 * impulsive action in the app — the whole gesture is "I might want this later" — and waiting
 * on a round trip for a 14px icon to fill makes the control feel broken. If the request
 * fails the heart flips back and a toast explains why, so the optimistic state can never
 * outlive the truth.
 *
 * **The fill is a spring pop** (`springs.bouncy`, scale 1.04 via `motionTokens.scale.pop`),
 * which is the one motion in the language reserved for exactly this. Reduced motion keeps
 * the colour change and drops the scale, so the state is still communicated — `prefers-
 * reduced-motion` removes the flourish, never the information.
 *
 * ## The whole button is the target, and it stops the card's link
 *
 * The card is entirely a link, so the heart sits outside the anchor and calls
 * `preventDefault`/`stopPropagation` on the click. Without that, every heart tap also
 * navigates to the book — which is how a heart ends up opening the page it was meant to
 * bookmark.
 *
 * `aria-pressed` carries the saved state, so the control announces itself as a toggle rather
 * than as an unlabelled heart, and the label says which action it will take.
 */
export function WishlistToggle({
  bookId,
  bookTitle,
  initialSaved,
  signedIn,
  variant = "icon",
  className,
  /** Called after a successful change, so a grid can drop the card without a refetch. */
  onChanged,
}: {
  bookId: string;
  bookTitle: string;
  /** From the server. The component owns the state after that. */
  initialSaved: boolean;
  signedIn: boolean;
  variant?: "icon" | "button";
  className?: string;
  onChanged?: (saved: boolean) => void;
}) {
  const reduced = useReducedMotion();
  const [saved, setSaved] = React.useState(initialSaved);
  const [busy, setBusy] = React.useState(false);

  // Keep the optimistic state honest if the server's answer arrives late with a different
  // value. Render-phase, not an effect, so there is no frame of the wrong heart.
  const [seed, setSeed] = React.useState(initialSaved);
  if (seed !== initialSaved) {
    setSeed(initialSaved);
    setSaved(initialSaved);
  }

  const toggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // The card around this is one big link. Let it be a button.
    event.preventDefault();
    event.stopPropagation();

    if (busy) return;

    const next = !saved;
    setSaved(next);
    setBusy(true);

    try {
      if (next) {
        await wishlistApi.add(bookId);
        toast.success("Saved to your reading list", {
          description: `“${bookTitle}” is waiting for you.`,
        });
      } else {
        await wishlistApi.remove(bookId);
      }
      onChanged?.(next);
    } catch (error) {
      // Roll back rather than leaving a heart that lies about the server.
      setSaved(!next);
      toast.error(next ? "Could not save that book" : "Could not remove that book", {
        description: toErrorMessage(error, "Please try again."),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!signedIn) {
    // No heart at all for a visitor. A grid of twenty hearts that all answer "sign in" is a
    // wall of controls that cannot be used, and it makes a reading-list feature look broken
    // on the one page a visitor will judge the site by. Decided here rather than in each
    // caller so a future call site cannot forget.
    return null;
  }

  const label = saved
    ? `Remove “${bookTitle}” from your reading list`
    : `Save “${bookTitle}” to your reading list`;

  if (variant === "button") {
    return (
      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        title={label}
        className={className}
      >
        <motion.span
          animate={reduced ? {} : { scale: saved ? 1.04 : 1 }}
          transition={springs.bouncy}
          className="inline-flex"
        >
          <Heart
            className={cn("size-4", saved && "fill-danger-ink text-danger-ink")}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </motion.span>
        {busy ? "Saving…" : saved ? "Saved" : "Add to wishlist"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      disabled={busy}
      // `aria-pressed` is what makes this announce as a toggle; the label says which way it
      // will go, which is more useful than the word "heart".
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn("shrink-0 text-muted-foreground hover:text-danger-ink", className)}
    >
      <motion.span
        animate={reduced ? {} : { scale: saved ? 1.04 : 1 }}
        transition={springs.bouncy}
        className="inline-flex"
      >
        <Heart
          className={cn(
            "size-4",
            saved ? "fill-danger-ink text-danger-ink" : "text-muted-foreground",
          )}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </motion.span>
    </Button>
  );
}