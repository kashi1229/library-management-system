"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lock,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "@/components/features/marketing/reveal";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { ROUTES } from "@/lib/constants";

const BENEFITS = [
  "Instant online reservations & queue alerts",
  "14-day loans with 2 flexible renewal extensions",
  "Curated reading wishlist & verified peer reviews",
  "Zero membership fees for all registered students & faculty",
] as const;

// Book spine heights for the skyline silhouette
const SPINES = [
  { h: 48, w: 28, delay: 0 },
  { h: 88, w: 22, delay: 0.06 },
  { h: 64, w: 30, delay: 0.12 },
  { h: 104, w: 18, delay: 0.18 },
  { h: 72, w: 26, delay: 0.24 },
  { h: 56, w: 32, delay: 0.30 },
  { h: 120, w: 20, delay: 0.36 },
  { h: 80, w: 24, delay: 0.42 },
  { h: 68, w: 28, delay: 0.48 },
  { h: 96, w: 22, delay: 0.54 },
  { h: 60, w: 30, delay: 0.60 },
  { h: 112, w: 18, delay: 0.66 },
  { h: 76, w: 26, delay: 0.72 },
  { h: 52, w: 32, delay: 0.78 },
  { h: 88, w: 20, delay: 0.84 },
  { h: 44, w: 28, delay: 0.90 },
  { h: 100, w: 24, delay: 0.96 },
  { h: 72, w: 22, delay: 1.02 },
  { h: 56, w: 30, delay: 1.08 },
  { h: 84, w: 18, delay: 1.14 },
] as const;

/**
 * Dark Forest CTA Band with animated book spine skyline.
 *
 * Enhancements from prompt.txt:
 * - Staggered book spine animation: each spine rises from bottom with spring
 * - Continuous gentle rise/fall motion once settled
 * - Dark forest green + parchment contrasts maintained
 * - Vignette overlay on the skyline
 */
export function CtaBand() {
  const reduced = usePrefersReducedMotion();

  return (
    <section
      aria-labelledby="cta-heading"
      className="relative isolate overflow-hidden bg-primary text-primary-foreground"
    >
      {/* Animated Book Spine Skyline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-[1] flex items-end justify-center overflow-hidden"
      >
        <div className="flex h-36 w-full max-w-6xl items-end gap-1.5 px-4">
          {SPINES.map((spine, index) => (
            <motion.span
              key={index}
              className="shrink-0 rounded-t-[3px] bg-primary-foreground/10"
              style={{ width: spine.w }}
              initial={reduced ? false : { height: 0, opacity: 0 }}
              whileInView={
                reduced
                  ? undefined
                  : {
                      height: spine.h,
                      opacity: 1,
                    }
              }
              viewport={{ once: true, amount: 0 }}
              transition={
                reduced
                  ? undefined
                  : {
                      height: {
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: spine.delay,
                      },
                      opacity: {
                        duration: 0.3,
                        delay: spine.delay,
                      },
                    }
              }
              animate={
                reduced
                  ? undefined
                  : {
                      y: [0, -(index % 3 === 0 ? 4 : index % 3 === 1 ? 6 : 3), 0],
                    }
              }
            >
              {/* Reduced height inline; uses whileInView for actual height */}
            </motion.span>
          ))}
        </div>
        {/* Vignette fade at the bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-primary to-transparent"
          aria-hidden="true"
        />
      </div>

      <div className="container-page py-16 sm:py-20 md:py-28">
        <Reveal className="mx-auto max-w-3xl text-center space-y-6">
          <span
            aria-hidden="true"
            className="mx-auto grid size-14 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground backdrop-blur-sm ring-1 ring-primary-foreground/20"
          >
            <Sparkles strokeWidth={1.75} className="size-7" />
          </span>

          <h2
            id="cta-heading"
            className="text-balance font-display text-h1 font-semibold tracking-[-0.02em]"
          >
            Begin your reading journey today
          </h2>

          <p className="mx-auto max-w-xl text-pretty text-body text-primary-foreground/80 leading-relaxed md:text-lg">
            Join the Athenaeum campus circulation network. Issue books, place automated holds,
            and keep track of your loans and fines from any device.
          </p>

          {/* Benefits Grid */}
          <div className="mx-auto grid max-w-xl gap-3 pt-2 text-start sm:grid-cols-2">
            {BENEFITS.map((item) => (
              <motion.div
                key={item}
                whileHover={reduced ? undefined : { x: 3 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2.5 text-small text-primary-foreground/90 font-medium"
              >
                <CheckCircle2 className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span>{item}</span>
              </motion.div>
            ))}
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col justify-center gap-3.5 pt-4 sm:flex-row sm:items-center">
            <motion.div
              whileHover={reduced ? undefined : { y: -2, scale: 1.02 }}
              whileTap={reduced ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <Link
                href={ROUTES.register}
                className={buttonVariants({
                  size: "lg",
                  variant: "accent",
                  className: "shadow-lg font-medium",
                })}
              >
                <UserPlus aria-hidden="true" strokeWidth={1.75} className="size-4" />
                <span>Create a member account</span>
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </motion.div>

            <motion.div
              whileHover={reduced ? undefined : { y: -2 }}
              whileTap={reduced ? undefined : { scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <Link
                href={ROUTES.catalog}
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className:
                    "border-primary-foreground/35 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground font-medium",
                })}
              >
                <BookOpen aria-hidden="true" strokeWidth={1.75} className="size-4" />
                <span>Explore public catalog</span>
              </Link>
            </motion.div>
          </div>

          {/* Institutional Trust Footer Note */}
          <div className="flex items-center justify-center gap-2 pt-4 text-caption text-primary-foreground/60">
            <Lock className="size-3.5" aria-hidden="true" />
            <span>Encrypted sessions · Direct university affiliation · Zero commercial tracking</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}