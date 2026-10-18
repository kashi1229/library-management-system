"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { ArrowRight, BookMarked, CheckCircle2, Clock, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CoverStack } from "@/components/features/marketing/cover-stack";
import { HeroSearch } from "@/components/features/marketing/hero-search";
import { LandingAtmosphere } from "@/components/features/marketing/landing-atmosphere";
import { motionTokens, transitions } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { ROUTES } from "@/lib/constants";
import type { CatalogBook } from "@/types";

const HEADLINE = ["Every", "story,", "within", "reach."];

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

  const container: Variants = {
    hidden: {},
    visible: {
      transition: reduced
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: 0.08, delayChildren: 0.04 },
    },
  };

  const rise: Variants = {
    hidden: { opacity: 0, y: reduced ? 0 : motionTokens.distance.md },
    visible: {
      opacity: 1,
      y: 0,
      transition: reduced ? transitions.fast : transitions.slow,
    },
  };

  return (
    <section className="relative isolate overflow-hidden border-b border-border">
      <LandingAtmosphere />

      <motion.div
        className="container-page grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:py-24"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        <div className="min-w-0">
          {/* Live Campus Circulation Indicator */}
          <motion.div variants={rise} className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/85 px-3.5 py-1.5 text-caption font-medium tracking-wide text-foreground shadow-sm backdrop-blur-md">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <span className="text-muted-foreground">{libraryName} Circulation</span>
              <span className="text-border">|</span>
              <span className="font-semibold text-accent-ink">Campus Active</span>
            </span>
          </motion.div>

          {/* Master Fraunces Headline */}
          <h1 className="mt-6 font-display text-hero font-semibold leading-[1.04] tracking-[-0.03em] text-balance text-foreground">
            {HEADLINE.map((word, index) => (
              <span
                key={word}
                className="inline-block overflow-hidden pb-[0.12em] align-bottom"
              >
                <motion.span
                  className="inline-block"
                  variants={rise}
                  transition={
                    reduced
                      ? transitions.fast
                      : { ...transitions.slow, delay: index * 0.06 }
                  }
                >
                  {word}
                  {index < HEADLINE.length - 1 ? "\u00A0" : ""}
                </motion.span>
              </span>
            ))}
          </h1>

          {/* Editorial Subcopy */}
          <motion.p
            variants={rise}
            className="mt-6 max-w-xl text-pretty text-body text-muted-foreground md:text-lg"
          >
            A college library catalog, circulation desk, reservation queue, and fine
            ledger in one cohesive workspace. Search physical stacks, place smart holds,
            and manage reading lists effortlessly.
          </motion.p>

          {/* Interactive Catalog Combobox */}
          <motion.div variants={rise} className="mt-8">
            <HeroSearch />
          </motion.div>

          {/* Action CTAs */}
          <motion.div
            variants={rise}
            className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center"
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
          </motion.div>

          {/* Key Assurance Badges */}
          <motion.div
            variants={rise}
            className="mt-8 flex flex-wrap items-center gap-y-2 gap-x-6 border-t border-border/80 pt-5 text-caption text-muted-foreground"
          >
            {PILLARS.map((pillar) => (
              <span key={pillar.label} className="inline-flex items-center gap-1.5 font-medium">
                <pillar.icon className="size-3.5 text-accent-ink" aria-hidden="true" />
                <span>{pillar.label}</span>
              </span>
            ))}
          </motion.div>
        </div>

        {/* 3D Physical Book Cluster */}
        <motion.div
          variants={rise}
          className="min-w-0 lg:ps-4"
          transition={reduced ? transitions.fast : { duration: 0.6 }}
        >
          <CoverStack books={covers} />
        </motion.div>
      </motion.div>
    </section>
  );
}