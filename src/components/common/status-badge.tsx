import * as React from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Badge, badgeVariants } from "@/components/ui/badge";

/**
 * Every status string the app can render, mapped to a tone exactly as specified
 * in ui-context.md §Component Conventions:
 *
 *   available=success · low=warning (≤1 copy) · unavailable=danger
 *   on_time=success · due_soon=warning · overdue=danger · returned=muted
 *   waiting=warning · ready=info · fulfilled=success · expired/cancelled=muted
 *   unpaid=danger · paid=success · waived=muted
 *   active=success · suspended=danger
 */
export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export type StatusBadgeTone = Extract<
  BadgeVariant,
  "success" | "warning" | "danger" | "info" | "secondary" | "default"
>;

export const STATUS_TONES = {
  // Availability
  available: "success",
  low: "warning",
  unavailable: "danger",
  // Loans (overdue is derived, never stored)
  on_time: "success",
  due_soon: "warning",
  overdue: "danger",
  returned: "secondary",
  // Reservations
  waiting: "warning",
  ready: "info",
  fulfilled: "success",
  expired: "secondary",
  cancelled: "secondary",
  // Fines
  unpaid: "danger",
  paid: "success",
  waived: "secondary",
  // Users
  active: "success",
  suspended: "danger",
  // Books
  archived: "secondary",
} as const satisfies Record<string, StatusBadgeTone>;

export type StatusKey = keyof typeof STATUS_TONES;

const TONE_DOT: Record<StatusBadgeTone, string> = {
  success: "bg-success-ink",
  warning: "bg-warning-ink",
  danger: "bg-danger-ink",
  info: "bg-info-ink",
  secondary: "bg-muted-foreground",
  default: "bg-primary-foreground",
};

export function statusTone(status: string): StatusBadgeTone {
  return STATUS_TONES[status as StatusKey] ?? "secondary";
}

type StatusBadgeProps = {
  status: string;
  /** Human label. Defaults to a title-cased version of `status`. */
  label?: React.ReactNode;
  /** Adds the leading status dot (on by default). */
  dot?: boolean;
  className?: string;
};

/**
 * Pill badge: soft tinted background, colored text, small dot.
 * Unknown statuses degrade to a neutral badge rather than throwing.
 */
export function StatusBadge({ status, label, dot = true, className }: StatusBadgeProps) {
  const tone = statusTone(status);

  return (
    <Badge variant={tone} className={cn("gap-1.5", className)}>
      {dot ? <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_DOT[tone])} /> : null}
      {label ?? humanize(status)}
    </Badge>
  );
}

/** `due_soon` → `Due soon`, `on_time` → `On time`. */
function humanize(status: string): string {
  const spaced = status.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
