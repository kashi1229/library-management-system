"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * Floating "Back to Top" navigation button.
 *
 * Appears when the reader scrolls past 450px.
 * Smoothly scrolls to the top of the page when tapped.
 */
export function BackToTop() {
  const [visible, setVisible] = React.useState(false);
  const reduced = usePrefersReducedMotion();

  React.useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 450);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll back to top"
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          whileHover={reduced ? undefined : { y: -2 }}
          whileTap={reduced ? undefined : { scale: 0.95 }}
          className="fixed bottom-6 right-6 z-40 grid size-11 place-items-center rounded-full border border-border/80 bg-surface/90 text-foreground shadow-lift backdrop-blur-md transition-colors hover:border-primary hover:bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
        >
          <ArrowUp className="size-5 text-accent-ink" aria-hidden="true" strokeWidth={2} />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
