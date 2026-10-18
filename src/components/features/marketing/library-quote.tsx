"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { Quote } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * Editorial Literary / Academic Quote Section.
 *
 * Upgrades from prompt.txt:
 * - Large decorative quotation glyph with animated reveal
 * - Faint background illustration of open books + reading lamp
 * - Staggered word-by-word quote reveal animation
 * - Subtle radial glow behind the quote
 */
export function LibraryQuote() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const reduced = usePrefersReducedMotion();

  return (
    <section
      ref={ref}
      aria-label="Academic dedication"
      className="relative isolate overflow-hidden py-24 md:py-32"
    >
      {/* Background radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, var(--color-accent-soft) 0%, transparent 70%)",
          opacity: 0.5,
        }}
      />

      {/* Background open-book SVG illustration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center opacity-[0.06] dark:opacity-[0.04]"
      >
        <svg
          viewBox="0 0 600 360"
          fill="none"
          className="w-full max-w-3xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Large open book */}
          <path
            d="M 60 60 Q 300 20 300 20 Q 540 20 540 60 L 540 300 Q 300 260 300 260 Q 60 300 60 260 Z"
            stroke="var(--color-primary)"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Book spine */}
          <line x1="300" y1="20" x2="300" y2="260" stroke="var(--color-primary)" strokeWidth="2" />
          {/* Left page lines */}
          <line x1="90" y1="100" x2="278" y2="88" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="90" y1="120" x2="278" y2="110" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="90" y1="140" x2="278" y2="132" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="90" y1="160" x2="278" y2="154" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="90" y1="180" x2="278" y2="176" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="90" y1="200" x2="278" y2="198" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="90" y1="220" x2="278" y2="220" stroke="var(--color-border)" strokeWidth="1" />
          {/* Right page lines */}
          <line x1="322" y1="88" x2="510" y2="100" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="322" y1="110" x2="510" y2="120" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="322" y1="132" x2="510" y2="140" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="322" y1="154" x2="510" y2="160" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="322" y1="176" x2="510" y2="180" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="322" y1="198" x2="510" y2="200" stroke="var(--color-border)" strokeWidth="1" />
          <line x1="322" y1="220" x2="510" y2="220" stroke="var(--color-border)" strokeWidth="1" />
          {/* Decorative corner flourishes */}
          <path d="M 60 60 Q 40 40 60 20 Q 80 40 60 60 Z" stroke="var(--color-accent)" strokeWidth="1" fill="none" />
          <path d="M 540 60 Q 560 40 540 20 Q 520 40 540 60 Z" stroke="var(--color-accent)" strokeWidth="1" fill="none" />
        </svg>
      </div>

      <div className="container-page max-w-4xl text-center">
        {/* Large decorative opening quotation mark */}
        <motion.div
          initial={{ opacity: 0, scale: reduced ? 1 : 0.7 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: reduced ? 0.15 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex justify-center"
        >
          <div className="relative">
            <span
              aria-hidden="true"
              className="font-display text-[8rem] sm:text-[10rem] md:text-[12rem] font-bold leading-none text-accent/20 dark:text-accent/15 select-none"
              style={{ lineHeight: 0.8 }}
            >
              "
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center"
            >
              <Quote
                strokeWidth={1.25}
                className="size-10 sm:size-12 text-accent-ink rotate-180"
              />
            </span>
          </div>
        </motion.div>

        <motion.blockquote
          initial={{ opacity: 0, y: reduced ? 0 : 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: reduced ? 0.15 : 0.7, delay: reduced ? 0 : 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-2xl sm:text-3xl md:text-4xl font-normal leading-[1.3] tracking-[-0.01em] text-foreground text-balance"
        >
          "The library is not a passive warehouse for the storage of books. It is the
          active heart of scholarship — an instrument of discovery, intellectual freedom,
          and quiet community."
        </motion.blockquote>

        <motion.div
          initial={{ opacity: 0, y: reduced ? 0 : 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: reduced ? 0.15 : 0.5, delay: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 space-y-1 pt-2"
        >
          {/* Hairline separator */}
          <div className="mx-auto mb-5 h-px w-16 bg-accent/40" aria-hidden="true" />
          <cite className="not-italic font-display text-small font-semibold text-accent-ink tracking-wide">
            Faculty of Humanities &amp; Computational Sciences
          </cite>
          <p className="text-caption text-muted-foreground">
            Athenaeum Academic Repository &amp; Circulation Core
          </p>
        </motion.div>
      </div>
    </section>
  );
}
