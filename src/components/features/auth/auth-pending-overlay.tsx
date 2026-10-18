"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Spinner } from "@/components/common/spinner";
import { useMotionVariants } from "@/hooks/use-motion-variants";

/**
 * The state between "the credentials were accepted" and "the destination has rendered".
 *
 * This gap is real and is the part a `isSubmitting` flag cannot cover. The login promise
 * resolves the moment the cookie is set; only then does the App Router start fetching the
 * dashboard. With nothing here, the login form reappears at rest — an enabled "Sign in"
 * button over credentials that are now valid — for as long as the next route takes to
 * stream. A user who presses it again sends a second request, and a user who does not is
 * looking at a page that appears to have ignored them.
 *
 * So the overlay covers the navigation rather than the request, and it is **not** the
 * element that announces itself: the form carries one polite live region for both phases.
 * Two live regions describing the same transition is how a screen reader ends up saying it
 * twice.
 */
export function AuthPendingOverlay({ title, description }: { title: string; description: string }) {
  const { scaleIn } = useMotionVariants();

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={scaleIn}
      // Decorative. The form's `role="status"` region carries the announcement.
      aria-hidden="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-5 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-sm flex-col items-center gap-5 overflow-hidden rounded-lg border border-border bg-surface px-8 py-10 text-center shadow-lift">
        {/* The thin accent rule the landing page's stat cards use. */}
        <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />

        <Spinner size="lg" className="[&>svg]:text-primary" />

        <div className="space-y-1.5">
          <p className="font-display text-h3 font-semibold tracking-[-0.02em] text-balance text-foreground">
            {title}
          </p>
          <p className="text-small text-pretty text-muted-foreground">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}
