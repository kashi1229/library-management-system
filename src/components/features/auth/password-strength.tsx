"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { springs } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";

/**
 * Four-segment password strength meter (Weak / Fair / Good / Strong).
 *
 * Announced politely so the label is not read on every keystroke, and the bar
 * width is a transform-free scale so it cannot cause layout shift.
 */

type Strength = 0 | 1 | 2 | 3 | 4;

const LEVELS: { label: string; segment: string; text: string }[] = [
  { label: "Too short", segment: "bg-muted", text: "text-muted-foreground" },
  { label: "Weak", segment: "bg-danger", text: "text-danger-ink" },
  { label: "Fair", segment: "bg-warning", text: "text-warning-ink" },
  { label: "Good", segment: "bg-info", text: "text-info-ink" },
  { label: "Strong", segment: "bg-success", text: "text-success-ink" },
];

/** Mirrors `passwordSchema` in `lib/validators/auth.ts` (F1). */
export function scorePassword(password: string): Strength {
  if (password.length === 0) return 0;
  if (password.length < 8) return 1;

  let score = 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  return Math.min(4, score) as Strength;
}

export function PasswordStrength({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const score = scorePassword(password);
  const level = LEVELS[score];
  const reduced = usePrefersReducedMotion();

  return (
    <div className={cn("space-y-2", className)} aria-live="polite">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((segment) => (
          <span key={segment} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.span
              className={cn("block h-full origin-left rounded-full", level.segment)}
              initial={false}
              animate={{ opacity: segment <= score ? 1 : 0, scaleX: segment <= score ? 1 : 0.4 }}
              transition={reduced ? { duration: 0.15 } : springs.snappy}
            />
          </span>
        ))}
      </div>
      <p className={cn("text-caption font-medium", level.text)}>
        {password.length > 0 && (
          <>
            <span className="sr-only">Password strength: </span>
            {level.label}
          </>
        )}
      </p>
    </div>
  );
}
