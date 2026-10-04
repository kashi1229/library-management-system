import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Pill badges (ui-context.md): soft tinted background + colored text.
 * Tinted variants use the `*-ink` foregrounds, which are the AA-safe pairings
 * for their matching `-soft` tint (raw status hues only reach ~2.5–3.2:1).
 * `StatusBadge` in `components/common` composes these for domain statuses.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden",
    "rounded-full px-2.5 py-0.5 text-caption font-medium whitespace-nowrap",
    "transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none",
    "[&>svg]:pointer-events-none [&>svg]:size-3 [&>svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline: "border border-border bg-transparent text-foreground",
        soft: "bg-accent-soft text-accent-ink",
        success: "bg-success-soft text-success-ink",
        warning: "bg-warning-soft text-warning-ink",
        danger: "bg-danger-soft text-danger-ink",
        info: "bg-info-soft text-info-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
