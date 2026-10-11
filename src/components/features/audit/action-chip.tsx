"use client";

import { cn } from "@/lib/utils";
import { auditPresentation } from "@/lib/audit-templates";

/**
 * A pill for one audit action.
 *
 * **Reuses `auditPresentation()` rather than drawing icons again.** The Unit 17 activity feed
 * already maps every action to an icon and an AA-safe `-soft`/`-ink` pair, and this is the same
 * information at a different size — a second map would be a second palette for the same event.
 *
 * **The action string is humanised, not prettified.** `loan.issue` becomes "Issue" from the part
 * after the dot, and the entity is prepended by the caller. A chip reading "loan.issue" is a
 * database value, and an administrator reading a register wants the word.
 */
export function ActionChip({ action, className }: { action: string; className?: string }) {
  const { icon: Icon, className: tone } = auditPresentation(action);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {humanise(action)}
    </span>
  );
}

/** `loan.issue` → `Issue` · `user.password_reset` → `Password reset`. */
export function humanise(action: string): string {
  const verb = action.split(".")[1] ?? action;
  return verb
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}