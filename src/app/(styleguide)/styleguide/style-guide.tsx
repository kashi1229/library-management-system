"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useMotionVariants } from "@/hooks/use-motion-variants";
import { TypographySection, SurfacesSection, FeedbackSection } from "./sections/surfaces";
import {
  ButtonsSection,
  BadgesSection,
  FormsSection,
  OverlaySection,
  DataSection,
} from "./sections/controls";
import { MotionSection } from "./sections/motion";
import { IconsSection, ChromeSection, ResponsiveSection } from "./sections/chrome";

const SECTIONS = [
  { id: "typography", label: "Typography" },
  { id: "colors", label: "Colour" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Badges" },
  { id: "forms", label: "Forms" },
  { id: "overlays", label: "Overlays" },
  { id: "data", label: "Data" },
  { id: "feedback", label: "Feedback" },
  { id: "motion", label: "Motion" },
  { id: "icons", label: "Icons" },
  { id: "chrome", label: "Chrome" },
  { id: "responsive", label: "Responsive" },
];

/**
 * Every token, primitive and motion rule in one place. Toggle the theme to
 * verify both palettes, then resize the window to check each breakpoint.
 */
export function StyleGuide() {
  const { fadeUp, stagger } = useMotionVariants();

  return (
    <main className="container-page space-y-14 py-12">
      <motion.header
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="space-y-3">
          <Logo />
          <h1 className="text-balance font-display text-hero font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
            Parchment &amp; Ink
          </h1>
          <p className="max-w-2xl text-pretty text-body text-muted-foreground">
            Design-system reference for Athenaeum. Toggle the theme to verify both palettes, then resize
            the window to check each breakpoint.
          </p>
        </div>
        <ThemeToggle className="shrink-0" />
      </motion.header>

      <motion.nav
        variants={stagger}
        initial="hidden"
        animate="visible"
        aria-label="Style guide sections"
        className="flex flex-wrap gap-2"
      >
        {SECTIONS.map((section) => (
          <motion.a
            key={section.id}
            variants={fadeUp}
            href={`#${section.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {section.label}
          </motion.a>
        ))}
      </motion.nav>

      <div className="space-y-14">
        <TypographySection />
        <SurfacesSection />
        <ButtonsSection />
        <BadgesSection />
        <FormsSection />
        <OverlaySection />
        <DataSection />
        <FeedbackSection />
        <MotionSection />
        <IconsSection />
        <ChromeSection />
        <ResponsiveSection />
      </div>

      <footer className="space-y-2 border-t border-border pt-6 text-caption text-muted-foreground">
        <p>
          Design tokens live in{" "}
          <code className="font-mono text-code break-all">src/app/globals.css</code>; motion values in{" "}
          <code className="font-mono text-code break-all">src/lib/motion.ts</code>.
        </p>
        <p className="inline-flex items-center gap-1.5">
          This route is compiled out of production builds.
          <ArrowUpRight className="size-3.5 shrink-0" />
        </p>
      </footer>
    </main>
  );
}
