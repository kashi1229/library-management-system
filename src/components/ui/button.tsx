import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Parchment & Ink buttons (ui-context.md §Component Conventions):
 * variants `default | secondary | outline | ghost | accent | destructive`,
 * sizes `sm | md | lg | icon`. Touch targets stay ≥ 40px on md and up.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md",
    "font-medium tracking-[-0.01em] transition-[background-color,color,border-color,box-shadow,transform]",
    "duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "focus-visible:ring-ring/45 focus-visible:ring-[3px] focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.98] motion-reduce:active:scale-100",
    "aria-invalid:border-danger aria-invalid:ring-danger/25",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-muted text-foreground hover:bg-muted/70",
        outline: "border border-border bg-surface text-foreground hover:bg-muted hover:border-foreground/20",
        ghost: "text-foreground hover:bg-muted",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Every size keeps a ≥40px pointer target (code-standards.md).
        sm: "h-10 gap-1.5 px-3 text-small has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-11 gap-2 px-4 text-small has-[>svg]:px-3.5",
        lg: "h-12 gap-2.5 px-6 text-body has-[>svg]:px-5",
        icon: "size-11",
        "icon-sm": "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "md",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
