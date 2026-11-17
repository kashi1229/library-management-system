"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BookMarked, CheckCircle2, Clock, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CoverStack } from "@/components/features/marketing/cover-stack";
import { HeroSearch } from "@/components/features/marketing/hero-search";
import { LandingAtmosphere } from "@/components/features/marketing/landing-atmosphere";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { ROUTES } from "@/lib/constants";
import type { CatalogBook } from "@/types";

const HEADLINE = ["Every", "story,", "within", "reach."];

/*
 * Stagger schedule for the `.hero-rise` entrances, in ms. It mirrors the old
 * motion container's `delayChildren: 0.04 / staggerChildren: 0.08` and the
 * headline's per-word `index * 0.06` — the same choreography, moved to CSS so
 * it runs at first paint instead of at hydration. See `.hero-rise` in
 * globals.css for why the entrance is not a motion variant.
 */
const STAGGER = {
  badge: 40,
  wordStart: 100,
  wordStep: 60,
  subcopy: 340,
  search: 400,
  cta: 460,
  pillars: 520,
  covers: 260,
} as const;

const PILLARS = [
  { icon: CheckCircle2, label: "Real-time Availability" },
  { icon: Clock, label: "FIFO Hold Priority" },
  { icon: BookMarked, label: "1-Click Loan Renewals" },
] as const;

/**
 * Newly engineered industrial-grade Hero component.
 *
 * Combines:
 * - Editorial Fraunces headline with staggered character-safe word reveal.
 * - Live campus status badge with pulsing operational indicator.
 * - Live catalog search engine with instant combobox suggestions.
 * - Interactive 3D floating physical book cluster with tilt physics.
 * - Distinct, accessible CTA buttons with tactile micro-interactions.
 */
export function Hero({
  covers,
  libraryName,
}: {
  covers: CatalogBook[];
  libraryName: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      <LandingAtmosphere />

      <div className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-24">
        <div className="min-w-0">
          {/* Live Campus Circulation Indicator */}
          <div
            className="hero-rise inline-flex items-center gap-2"
            style={{ animationDelay: `${STAGGER.badge}ms` }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/85 px-3.5 py-1.5 text-caption font-medium tracking-wide text-foreground shadow-sm backdrop-blur-md">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <span className="text-muted-foreground">{libraryName} Circulation</span>
              <span className="text-border">|</span>
              <span className="font-semibold text-accent-ink">Campus Active</span>
            </span>
          </div>

          {/* Master Fraunces Headline */}
          <h1 className="mt-6 font-display text-hero font-semibold leading-[1.04] tracking-[-0.03em] text-balance text-foreground">
            {HEADLINE.map((word, index) => (
              <span
                key={word}
                className="inline-block overflow-hidden pb-[0.12em] align-bottom"
              >
                <span
                  className="hero-rise inline-block"
                  style={{
                    animationDelay: `${STAGGER.wordStart + index * STAGGER.wordStep}ms`,
                  }}
                >
                  {word}
                  {index < HEADLINE.length - 1 ? "\u00A0" : ""}
                </span>
              </span>
            ))}
          </h1>

          {/* Editorial Subcopy */}
          <p
            className="hero-rise mt-6 max-w-xl text-pretty text-body text-muted-foreground md:text-lg"
            style={{ animationDelay: `${STAGGER.subcopy}ms` }}
          >
            A college library catalog, circulation desk, reservation queue, and fine
            ledger in one cohesive workspace. Search physical stacks, place smart holds,
            and manage reading lists effortlessly.
          </p>

          {/* Interactive Catalog Combobox */}
          <div
            className="hero-rise mt-8"
            style={{ animationDelay: `${STAGGER.search}ms` }}
          >
            <HeroSearch />
          </div>

          {/* Action CTAs — the entrance is CSS; motion stays for the tactile hover. */}
          <div
            className="hero-rise mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center"
            style={{ animationDelay: `${STAGGER.cta}ms` }}
          >
            <motion.div
              whileHover={reduced ? undefined : { y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.98 }}
            >
              <Link
                href={ROUTES.catalog}
                className={buttonVariants({
                  size: "lg",
                  className: "shadow-md hover:shadow-lg transition-all",
                })}
              >
                Browse the catalog
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </motion.div>

            <motion.div
              whileHover={reduced ? undefined : { y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.98 }}
            >
              <Link
                href={ROUTES.register}
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "border-border/90 bg-surface/80 hover:bg-muted shadow-sm transition-all",
                })}
              >
                <UserPlus aria-hidden="true" className="size-4 text-accent" />
                Create member account
              </Link>
            </motion.div>
          </div>

          {/* Key Assurance Badges */}
          <div
            className="hero-rise mt-8 flex flex-wrap items-center gap-y-2 gap-x-6 border-t border-border/80 pt-5 text-caption text-muted-foreground"
            style={{ animationDelay: `${STAGGER.pillars}ms` }}
          >
            {PILLARS.map((pillar) => (
              <span key={pillar.label} className="inline-flex items-center gap-1.5 font-medium">
                <pillar.icon className="size-3.5 text-accent-ink" aria-hidden="true" />
                <span>{pillar.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* 3D Physical Book Cluster */}
        <div
          className="hero-rise min-w-0 lg:ps-4"
          style={{ animationDelay: `${STAGGER.covers}ms` }}
        >
          <CoverStack books={covers} />
        </div>
      </div>
    </section>
  );
}