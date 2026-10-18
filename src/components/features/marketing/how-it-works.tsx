"use client";

import * as React from "react";
import {
  ArrowRight,
  BookMarked,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Reveal } from "@/components/features/marketing/reveal";
import { SectionEyebrow } from "@/components/features/marketing/section-eyebrow";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "step-1",
    stepNumber: "01",
    Icon: Search,
    title: "Discover & Locate",
    summary: "Instant boolean search, ISBN lookup, and live shelf coordinates.",
    description:
      "Search by title, author, ISBN, or subject tag. Check real-time shelf status ('Shelf B-12') and verify whether physical copies are available before walking to the desk.",
    preview: {
      tag: "Live Catalog Lookup",
      headline: "The Pragmatic Programmer",
      subline: "Shelf Location: CompSci A-04 · 3 of 4 Copies Available",
      accent: "Available Now",
      accentColor: "bg-success-soft text-success-ink",
    },
  },
  {
    id: "step-2",
    stepNumber: "02",
    Icon: BookMarked,
    title: "Borrow & Smart Queue",
    summary: "Desk checkout with member ID and FIFO hold reservation.",
    description:
      "Librarians issue books directly to your digital account with a 14-day loan window. When every copy is currently borrowed, tap Reserve to join an automated FIFO hold queue.",
    preview: {
      tag: "Automated FIFO Hold",
      headline: "Queue Position: #1 in Line",
      subline: "Held for 48 Hours upon return · In-app notification ready",
      accent: "48h Hold Window",
      accentColor: "bg-warning-soft text-warning-ink",
    },
  },
  {
    id: "step-3",
    stepNumber: "03",
    Icon: RotateCcw,
    title: "Renew & Review",
    summary: "1-click digital renewals and transparent ledger tracking.",
    description:
      "Renew loans from your personal dashboard if no other reader is in queue. When returned, leave verified peer ratings and track transparent fine records if overdue.",
    preview: {
      tag: "Self-Service Circulation",
      headline: "Loan Status: Due in 5 Days",
      subline: "Eligible for 2 renewals (+7 days each) · Zero late penalty",
      accent: "Renew with 1 Click",
      accentColor: "bg-info-soft text-info-ink",
    },
  },
] as const;

/**
 * Interactive Circulation Lifecycle Walkthrough.
 *
 * Enhancements from prompt.txt:
 * - Proper ARIA tablist/tab/tabpanel roles for full keyboard accessibility
 * - AnimatePresence cross-fade/slide on panel switch
 * - Connecting line draws on scroll entry
 */
export function HowItWorks() {
  const [activeStep, setActiveStep] = React.useState(0);
  const reduced = usePrefersReducedMotion();
  const current = STEPS[activeStep];

  const tabListId = React.useId();

  return (
    <section aria-labelledby="how-it-works-heading" className="relative py-16 md:py-24">
      {/* Subtle radial bloom background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, var(--color-primary-soft) 0%, transparent 70%)",
          opacity: 0.4,
        }}
      />

      <div className="container-page space-y-12">
        {/* Section Header */}
        <Reveal className="max-w-2xl space-y-3">
          <SectionEyebrow>Circulation Flow</SectionEyebrow>
          <h2
            id="how-it-works-heading"
            className="text-balance font-display text-h1 font-semibold tracking-[-0.02em] text-foreground"
          >
            How borrowing works at Athenaeum
          </h2>
          <p className="text-pretty text-body text-muted-foreground">
            Clear invariants, zero surprise penalties, and automated reservation
            queues designed for modern campus life.
          </p>
        </Reveal>

        {/* ARIA Tablist — Step Selector Grid */}
        <div
          role="tablist"
          id={tabListId}
          aria-label="Borrowing workflow steps"
          className="relative grid gap-6 md:grid-cols-3 md:gap-8"
        >
          {/* Animated Connecting SVG Line (draws on scroll) */}
          <svg
            aria-hidden="true"
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-[16.66%] top-9 hidden h-2 w-[66.66%] md:block"
          >
            <line
              x1="0"
              y1="4"
              x2="100"
              y2="4"
              stroke="var(--color-border)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <line
              className="how-it-works__draw"
              x1="0"
              y1="4"
              x2="100"
              y2="4"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              pathLength={1}
            />
          </svg>

          {STEPS.map((step, index) => {
            const isSelected = index === activeStep;
            const Icon = step.Icon;

            return (
              <Reveal
                key={step.id}
                as="div"
                delay={index * 0.08}
                className="relative flex min-w-0"
              >
                <button
                  type="button"
                  role="tab"
                  id={`${tabListId}-tab-${index}`}
                  aria-controls={`${tabListId}-panel`}
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setActiveStep(index)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") {
                      e.preventDefault();
                      setActiveStep((prev) => (prev + 1) % STEPS.length);
                    } else if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      setActiveStep((prev) => (prev - 1 + STEPS.length) % STEPS.length);
                    }
                  }}
                  className={cn(
                    "group relative flex w-full flex-col rounded-xl border p-6 text-start transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
                    isSelected
                      ? "border-accent/60 bg-surface shadow-lift ring-1 ring-accent/30"
                      : "border-border/80 bg-surface/70 hover:border-border hover:bg-surface hover:shadow-soft",
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative z-[1] grid size-13 shrink-0 place-items-center rounded-xl border transition-all duration-200",
                        isSelected
                          ? "border-accent bg-accent-soft text-accent-ink shadow-sm"
                          : "border-border bg-surface text-primary group-hover:border-primary/40",
                      )}
                    >
                      <motion.div
                        animate={
                          isSelected && !reduced
                            ? { rotate: [0, -8, 8, 0], scale: [1, 1.1, 1.1, 1] }
                            : {}
                        }
                        transition={{ duration: 0.4 }}
                      >
                        <Icon strokeWidth={1.75} className="size-6" />
                      </motion.div>
                    </span>

                    <span className="font-mono text-small font-bold text-muted-foreground">
                      {step.stepNumber}
                    </span>
                  </div>

                  <div className="mt-5 space-y-1.5">
                    <h3 className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-accent-ink">
                      {step.title}
                    </h3>
                    <p className="text-small text-muted-foreground leading-relaxed">
                      {step.summary}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-caption font-semibold text-accent-ink">
                    <span>{isSelected ? "Active Phase" : "Inspect Details"}</span>
                    <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </button>
              </Reveal>
            );
          })}
        </div>

        {/* Interactive Feature Deep Dive Panel with AnimatePresence */}
        <div
          role="tabpanel"
          id={`${tabListId}-panel`}
          aria-labelledby={`${tabListId}-tab-${activeStep}`}
          className="rounded-2xl border border-border/80 bg-surface/90 p-6 md:p-8 shadow-soft overflow-hidden"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: reduced ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center"
            >
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-caption font-semibold text-accent-ink">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>Phase {current.stepNumber} Workflow</span>
                </div>

                <h4 className="font-display text-2xl font-semibold text-foreground">
                  {current.title}
                </h4>

                <p className="text-pretty text-body text-muted-foreground leading-relaxed">
                  {current.description}
                </p>

                <div className="flex flex-wrap gap-4 pt-2 text-caption font-medium text-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-success" />
                    Enforced business rules
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4 text-accent" />
                    Real-time ledger updates
                  </span>
                </div>
              </div>

              {/* Live Interactive Mock Preview Box */}
              <div className="relative rounded-xl border border-border bg-muted/60 p-5 shadow-inner">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  {current.preview.tag}
                </span>

                <div className="mt-3 rounded-lg border border-border/80 bg-surface p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-small font-bold text-foreground">
                        {current.preview.headline}
                      </p>
                      <p className="mt-1 text-caption text-muted-foreground">
                        {current.preview.subline}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${current.preview.accentColor}`}
                    >
                      {current.preview.accent}
                    </span>
                  </div>
                </div>

                {/* Mock step indicators */}
                <div className="mt-3 flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors duration-300",
                        i === activeStep ? "bg-accent" : "bg-border",
                      )}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}