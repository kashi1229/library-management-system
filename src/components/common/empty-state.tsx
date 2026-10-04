import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  /** Lucide icon component, e.g. `BookOpen`. Rendered inside the accent circle. */
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  /** One sentence explaining why the list is empty. */
  description?: React.ReactNode;
  /** Primary recovery action — always give the user a way forward. */
  action?: React.ReactNode;
  /** Secondary action, shown next to the primary. */
  secondaryAction?: React.ReactNode;
  className?: string;
};

/**
 * Empty state (ui-context.md): centered icon in an `accent-soft` circle,
 * serif headline, one sentence, primary action.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <div className="max-w-md space-y-1.5">
        <h3 className="font-display text-h3 font-semibold text-balance text-foreground">{title}</h3>
        {description ? (
          <p className="text-body text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="flex flex-col items-center gap-2 sm:flex-row">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

/** Convenience wrapper for the common "nothing here yet" primary action. */
export function EmptyStateAction({
  label,
  onClick,
  icon,
  variant = "default",
}: {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button variant={variant} onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}
