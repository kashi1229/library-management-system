"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * Hero Section Atmospheric Layer.
 *
 * Three depths of parallax:
 * - Background: architectural arch SVG (slowest)
 * - Mid: ambient radiance blooms + dotted grid (medium)
 * - Foreground: floating page fragments + grain overlay (fastest)
 *
 * All elements are aria-hidden, pointer-events-none, -z-10.
 * Works in both light and dark themes via CSS variables.
 */
export function LandingAtmosphere() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const archY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "-18%"]);
  const bloomY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "-28%"]);
  const pagesY = useTransform(scrollYProgress, [0, 1], ["0%", reduced ? "0%" : "-40%"]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden select-none"
    >
      {/* 1. Fine Architectural Coordinate Grid */}
      <div
        className="absolute inset-0 opacity-[0.28] dark:opacity-[0.15]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, var(--color-border) 1px, transparent 0),
            linear-gradient(to right, var(--color-border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px, 80px 80px, 80px 80px",
          backgroundPosition: "-1px -1px, -1px -1px, -1px -1px",
          maskImage:
            "radial-gradient(ellipse 90% 75% at 50% 15%, black 25%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 75% at 50% 15%, black 25%, transparent 80%)",
        }}
      />

      {/* 2. Primary Radiance Bloom — parallax layer 1 (slow) */}
      <motion.div
        style={{ y: bloomY }}
        className="absolute -top-40 left-1/2 h-[46rem] w-[80rem] -translate-x-1/2 rounded-full opacity-55 blur-3xl dark:opacity-30"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--color-accent-soft) 0%, transparent 65%)",
          }}
        />
      </motion.div>

      {/* 3. Secondary Forest Bloom */}
      <motion.div
        style={{ y: bloomY }}
        className="absolute top-[36rem] right-[-14rem] h-[38rem] w-[52rem] rounded-full opacity-35 blur-3xl dark:opacity-20"
      >
        <div
          className="h-full w-full rounded-full"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--color-primary-soft) 0%, transparent 70%)",
          }}
        />
      </motion.div>

      {/* 4. Classical Library Arch Line Art — parallax layer 2 (medium) */}
      <motion.div
        style={{ y: archY }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl opacity-[0.11] dark:opacity-[0.07]"
      >
        <svg
          viewBox="0 0 1100 720"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          {/* Main library arch */}
          <path
            d="M 120 720 V 340 C 120 150, 300 55, 550 55 C 800 55, 980 150, 980 340 V 720"
            stroke="var(--color-primary)"
            strokeWidth="1.4"
            strokeDasharray="5 7"
          />
          <path
            d="M 180 720 V 360 C 180 195, 340 110, 550 110 C 760 110, 920 195, 920 360 V 720"
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
          <path
            d="M 240 720 V 380 C 240 238, 380 168, 550 168 C 720 168, 860 238, 860 380 V 720"
            stroke="var(--color-accent)"
            strokeWidth="0.9"
            strokeDasharray="6 5"
          />

          {/* Keystone crown */}
          <circle cx="550" cy="55" r="10" stroke="var(--color-accent)" strokeWidth="1.5" fill="none" />
          <circle cx="550" cy="55" r="3.5" fill="var(--color-accent)" />
          <line x1="550" y1="0" x2="550" y2="168" stroke="var(--color-border)" strokeWidth="0.9" strokeDasharray="3 5" />

          {/* Horizontal transom beams */}
          <line x1="100" y1="340" x2="1000" y2="340" stroke="var(--color-border)" strokeWidth="1.1" />
          <line x1="140" y1="400" x2="960" y2="400" stroke="var(--color-border)" strokeWidth="0.75" strokeDasharray="5 4" />
          <line x1="180" y1="460" x2="920" y2="460" stroke="var(--color-border)" strokeWidth="0.6" strokeDasharray="3 6" />

          {/* Column pillars */}
          <line x1="120" y1="340" x2="120" y2="720" stroke="var(--color-border)" strokeWidth="0.9" />
          <line x1="980" y1="340" x2="980" y2="720" stroke="var(--color-border)" strokeWidth="0.9" />

          {/* Stacked Books cluster — left side */}
          <rect x="155" y="590" width="42" height="62" rx="2" stroke="var(--color-primary)" strokeWidth="1" fill="none" />
          <rect x="162" y="575" width="36" height="68" rx="2" stroke="var(--color-accent)" strokeWidth="0.9" fill="none" />
          <rect x="148" y="608" width="30" height="52" rx="2" stroke="var(--color-primary)" strokeWidth="0.8" fill="none" />
          <line x1="148" y1="610" x2="178" y2="610" stroke="var(--color-border)" strokeWidth="0.7" />
          <line x1="155" y1="625" x2="197" y2="625" stroke="var(--color-border)" strokeWidth="0.7" />
          <line x1="162" y1="640" x2="198" y2="640" stroke="var(--color-border)" strokeWidth="0.7" />

          {/* Reading Lamp — right side */}
          <line x1="900" y1="720" x2="900" y2="560" stroke="var(--color-primary)" strokeWidth="1.5" />
          <path d="M 875 560 Q 900 520 925 560 Z" stroke="var(--color-accent)" strokeWidth="1.2" fill="none" />
          <ellipse cx="900" cy="562" rx="26" ry="6" stroke="var(--color-accent)" strokeWidth="1" fill="none" />
          {/* Lamp glow rays */}
          <line x1="900" y1="568" x2="870" y2="620" stroke="var(--color-accent)" strokeWidth="0.6" strokeDasharray="2 5" opacity="0.6" />
          <line x1="900" y1="568" x2="930" y2="618" stroke="var(--color-accent)" strokeWidth="0.6" strokeDasharray="2 5" opacity="0.6" />
          <line x1="900" y1="568" x2="900" y2="640" stroke="var(--color-accent)" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.5" />

          {/* Stacked Books — right near lamp */}
          <rect x="910" y="618" width="46" height="58" rx="2" stroke="var(--color-primary)" strokeWidth="1" fill="none" />
          <rect x="918" y="605" width="38" height="64" rx="2" stroke="var(--color-accent)" strokeWidth="0.9" fill="none" />
          <line x1="910" y1="630" x2="956" y2="630" stroke="var(--color-border)" strokeWidth="0.7" />
          <line x1="918" y1="645" x2="956" y2="645" stroke="var(--color-border)" strokeWidth="0.7" />

          {/* Floating open book — top center */}
          <path d="M 430 200 Q 550 180 670 200" stroke="var(--color-primary)" strokeWidth="1" fill="none" />
          <path d="M 430 200 Q 430 240 550 248 Q 670 240 670 200" stroke="var(--color-primary)" strokeWidth="0.9" fill="none" />
          <line x1="550" y1="180" x2="550" y2="248" stroke="var(--color-border)" strokeWidth="0.8" strokeDasharray="3 4" />
          {/* Page lines */}
          <line x1="462" y1="210" x2="542" y2="214" stroke="var(--color-border)" strokeWidth="0.6" />
          <line x1="464" y1="220" x2="540" y2="224" stroke="var(--color-border)" strokeWidth="0.6" />
          <line x1="466" y1="230" x2="538" y2="234" stroke="var(--color-border)" strokeWidth="0.6" />
          <line x1="558" y1="214" x2="636" y2="210" stroke="var(--color-border)" strokeWidth="0.6" />
          <line x1="558" y1="224" x2="634" y2="220" stroke="var(--color-border)" strokeWidth="0.6" />
          <line x1="558" y1="234" x2="632" y2="230" stroke="var(--color-border)" strokeWidth="0.6" />
        </svg>
      </motion.div>

      {/* 5. Floating Page Fragments — parallax layer 3 (fastest) */}
      <motion.div style={{ y: pagesY }} className="absolute inset-0">
        {/* Page 1 */}
        <motion.div
          className="absolute top-[22%] left-[8%] h-16 w-12 opacity-[0.12] dark:opacity-[0.07]"
          animate={reduced ? undefined : {
            rotate: [-4, 2, -4],
            y: [0, -8, 0],
          }}
          transition={reduced ? undefined : {
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <svg viewBox="0 0 48 64" fill="none">
            <rect x="1" y="1" width="46" height="62" rx="2" stroke="var(--color-primary)" strokeWidth="1" />
            <line x1="8" y1="14" x2="40" y2="14" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="8" y1="22" x2="40" y2="22" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="8" y1="30" x2="32" y2="30" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="8" y1="38" x2="38" y2="38" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="8" y1="46" x2="28" y2="46" stroke="var(--color-border)" strokeWidth="0.8" />
          </svg>
        </motion.div>

        {/* Page 2 */}
        <motion.div
          className="absolute top-[35%] right-[6%] h-20 w-14 opacity-[0.10] dark:opacity-[0.06]"
          animate={reduced ? undefined : {
            rotate: [5, -3, 5],
            y: [0, 10, 0],
          }}
          transition={reduced ? undefined : {
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          }}
        >
          <svg viewBox="0 0 56 80" fill="none">
            <rect x="1" y="1" width="54" height="78" rx="2" stroke="var(--color-accent)" strokeWidth="1" />
            <line x1="10" y1="18" x2="46" y2="18" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="10" y1="27" x2="46" y2="27" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="10" y1="36" x2="38" y2="36" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="10" y1="45" x2="44" y2="45" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="10" y1="54" x2="30" y2="54" stroke="var(--color-border)" strokeWidth="0.8" />
          </svg>
        </motion.div>

        {/* Page 3 — small top right */}
        <motion.div
          className="absolute top-[12%] right-[22%] h-10 w-8 opacity-[0.09] dark:opacity-[0.05]"
          animate={reduced ? undefined : {
            rotate: [-6, 2, -6],
            y: [0, -6, 0],
          }}
          transition={reduced ? undefined : {
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
        >
          <svg viewBox="0 0 32 40" fill="none">
            <rect x="1" y="1" width="30" height="38" rx="2" stroke="var(--color-primary)" strokeWidth="1" />
            <line x1="6" y1="12" x2="26" y2="12" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="6" y1="20" x2="26" y2="20" stroke="var(--color-border)" strokeWidth="0.8" />
            <line x1="6" y1="28" x2="20" y2="28" stroke="var(--color-border)" strokeWidth="0.8" />
          </svg>
        </motion.div>
      </motion.div>

      {/* 6. Grain Texture Overlay */}
      <div
        className="absolute inset-0 opacity-[0.025] dark:opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
}
