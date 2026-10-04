"use client";

import * as React from "react";
import { motion } from "motion/react";
import { CircleX, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

type BannerTone = "danger" | "warning" | "info";

const TONE_STYLES: Record<BannerTone, { wrap: string; icon: React.ReactNode }> = {
  danger: {
    wrap: "border-danger/30 bg-danger-soft text-danger-ink",
    icon: <CircleX className="size-[18px] shrink-0" strokeWidth={1.75} />,
  },
  warning: {
    wrap: "border-warning/30 bg-warning-soft text-warning-ink",
    icon: <TriangleAlert className="size-[18px] shrink-0" strokeWidth={1.75} />,
  },
  info: {
    wrap: "border-info/30 bg-info-soft text-info-ink",
    icon: <Info className="size-[18px] shrink-0" strokeWidth={1.75} />,
  },
};

/**
 * Form-level message: invalid credentials, rate limiting, or a network failure.
 *
 * `role="alert"` + `aria-live="assertive"` means a screen reader announces the
 * message as soon as it appears. `key` on the message restarts the shake when a
 * second identical failure occurs.
 */
export function FormAlert({
  message,
  tone = "danger",
  className,
}: {
  message: string | null;
  tone?: BannerTone;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();

  if (!message) return null;

  const style = TONE_STYLES[tone];

  return (
    <motion.div
      key={message}
      role="alert"
      aria-live="assertive"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
      transition={
        reduced
          ? { duration: 0.15 }
          : { opacity: { duration: 0.15 }, y: transitionsFast, x: { duration: 0.4, ease: "easeOut" } }
      }
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-small leading-relaxed",
        style.wrap,
        className,
      )}
    >
      {style.icon}
      <span className="min-w-0">{message}</span>
    </motion.div>
  );
}

const transitionsFast = { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const };
export { springs };
