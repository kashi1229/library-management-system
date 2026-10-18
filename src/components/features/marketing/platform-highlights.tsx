"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import {
  Database,
  FileSpreadsheet,
  ImageIcon,
  Palette,
  ShieldCheck,
} from "lucide-react";
import { Reveal } from "@/components/features/marketing/reveal";
import { SectionEyebrow } from "@/components/features/marketing/section-eyebrow";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

const CAPABILITIES = [
  {
    icon: Database,
    badge: "Circulation Invariants",
    title: "Transactional Integrity",
    description:
      "All loan issues, returns, and queue promotions execute in atomic MongoDB sessions. Physical copy limits are guaranteed: a book can never be issued beyond total stock or while held for an active reservation.",
    accent: "text-success-ink bg-success-soft",
    iconBg: "bg-success-soft",
    iconColor: "text-success-ink",
    stat: "100% Atomic",
    gradientFrom: "from-success/20",
    gradientTo: "to-transparent",
  },
  {
    icon: Palette,
    badge: "Editorial System",
    title: "Parchment & Ink Theme",
    description:
      "Engineered with editorial Fraunces typography, soft paper surfaces, and WCAG 2.2 AA compliant contrast. The theme flips seamlessly between daytime parchment and night-time charcoal reading rooms.",
    accent: "text-accent-ink bg-accent-soft",
    iconBg: "bg-accent-soft",
    iconColor: "text-accent-ink",
    stat: "WCAG 2.2 AA",
    gradientFrom: "from-accent/20",
    gradientTo: "to-transparent",
  },
  {
    icon: ImageIcon,
    badge: "Asset Pipeline",
    title: "Cloudinary CDN & Covers",
    description:
      "Secure signed cover uploads with on-the-fly format and quality optimization (`f_auto,q_auto`). Missing covers gracefully fallback to mathematically generated typographic book plates.",
    accent: "text-info-ink bg-info-soft",
    iconBg: "bg-info-soft",
    iconColor: "text-info-ink",
    stat: "Signed Uploads",
    gradientFrom: "from-info/20",
    gradientTo: "to-transparent",
  },
  {
    icon: FileSpreadsheet,
    badge: "Enterprise Reporting",
    title: "Live Analytics & CSV Export",
    description:
      "Real-time MongoDB aggregation pipelines compute borrowing velocities, category breakdowns, and fine ledgers. Export any report directly to RFC 4180 compliant CSV with defused formula injection.",
    accent: "text-warning-ink bg-warning-soft",
    iconBg: "bg-warning-soft",
    iconColor: "text-warning-ink",
    stat: "RFC 4180 CSV",
    gradientFrom: "from-warning/20",
    gradientTo: "to-transparent",
  },
] as const;

/**
 * Spotlight card with cursor-following glow effect.
 * Lifted from prompt.txt: "cursor-following spotlight glow".
 */
function SpotlightCard({
  item,
  index,
}: {
  item: (typeof CAPABILITIES)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const spotlightX = useTransform(mouseX, (val) => `${val}px`);
  const spotlightY = useTransform(mouseY, (val) => `${val}px`);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }

  const Icon = item.icon;

  return (
    <Reveal
      delay={index * 0.08}
      className="group relative"
    >
      <motion.div
        ref={ref}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={reduced ? undefined : { y: -4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 shadow-soft"
      >
        {/* Cursor-following spotlight glow */}
        {!reduced && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300"
            style={{
              opacity: isHovered ? 1 : 0,
              background: isHovered
                ? `radial-gradient(300px circle at ${spotlightX.get()}px ${spotlightY.get()}px, var(--color-accent-soft), transparent 60%)`
                : "none",
            }}
          />
        )}

        {/* Animated gradient border on hover */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(135deg, var(--color-accent)/30, var(--color-primary)/20, transparent 60%)",
            padding: "1px",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Corner ambient glow */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -bottom-8 size-40 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(circle, var(--color-accent-soft) 0%, transparent 70%)`,
          }}
        />

        <div>
          <div className="flex items-center justify-between gap-3">
            <motion.span
              aria-hidden="true"
              whileHover={reduced ? undefined : { rotate: [0, -10, 10, 0], scale: 1.1 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className={`grid size-12 place-items-center rounded-xl border border-border/80 bg-surface ${item.iconBg} shadow-xs transition-all duration-200`}
            >
              <Icon strokeWidth={1.75} className={`size-6 ${item.iconColor}`} />
            </motion.span>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${item.accent}`}
            >
              {item.stat}
            </span>
          </div>

          <div className="mt-6 space-y-2">
            <span className="text-caption font-semibold tracking-wider text-accent-ink uppercase">
              {item.badge}
            </span>
            <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {item.title}
            </h3>
            <p className="text-pretty text-small text-muted-foreground leading-relaxed pt-1">
              {item.description}
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 border-t border-border/60 pt-4 text-caption text-muted-foreground">
          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          <span>Verified in production test suite</span>
        </div>
      </motion.div>
    </Reveal>
  );
}

/**
 * Industrial-Grade Architectural Capabilities Bento Grid.
 *
 * Enhancements from prompt.txt:
 * - Cursor-following spotlight glow on each card
 * - Animated gradient border on hover
 * - Icon micro-animation on hover (wiggle + scale)
 */
export function PlatformHighlights() {
  return (
    <section
      aria-labelledby="platform-highlights-heading"
      className="relative border-b border-border bg-muted/40 py-16 md:py-24"
    >
      {/* Subtle section divider at top */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-border to-transparent"
      />

      <div className="container-page space-y-12">
        {/* Header */}
        <Reveal className="max-w-2xl space-y-3">
          <SectionEyebrow>System Architecture</SectionEyebrow>
          <h2
            id="platform-highlights-heading"
            className="text-balance font-display text-h1 font-semibold tracking-[-0.02em] text-foreground"
          >
            Engineered for campus scale and institutional trust
          </h2>
          <p className="text-pretty text-body text-muted-foreground">
            Beneath the warm, editorial reading room aesthetic lies a hardened circulation
            engine designed according to strict database invariants and university access policies.
          </p>
        </Reveal>

        {/* Bento Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {CAPABILITIES.map((item, index) => (
            <SpotlightCard key={item.title} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
