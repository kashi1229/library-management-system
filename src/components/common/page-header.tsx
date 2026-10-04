import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  /** Serif H1 — keep it to one line of meaning, not a slogan. */
  title: React.ReactNode;
  /** Muted supporting sentence. Omit for terse utility pages. */
  description?: React.ReactNode;
  /** Right-aligned primary action (button, dropdown, or link group). */
  action?: React.ReactNode;
  /** Optional breadcrumb trail rendered above the title. */
  breadcrumb?: React.ReactNode;
  className?: string;
};

/**
 * Standard page header (ui-context.md §Layout Patterns):
 * serif H1, muted description, right-aligned primary action.
 */
export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {breadcrumb ? <div className="text-caption text-muted-foreground">{breadcrumb}</div> : null}
        <h1 className="text-h1 font-display font-semibold text-pretty text-foreground md:text-h1">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-body text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}
