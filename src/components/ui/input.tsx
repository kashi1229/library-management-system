import * as React from "react";
import { cn } from "@/lib/utils";
import { useField } from "@/components/ui/field";

/**
 * Inputs are 44px tall with an `input` border and a `ring` focus state
 * (ui-context.md §Component Conventions).
 */
function Input({ className, type, id, ...props }: React.ComponentProps<"input">) {
  const field = useField();

  return (
    <input
      id={id ?? field?.id}
      type={type}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      data-slot="input"
      className={cn(
        "flex h-11 w-full min-w-0 rounded-md border border-input bg-surface px-3.5 py-2",
        "text-body text-foreground transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "aria-invalid:border-danger aria-invalid:ring-danger/25",
        "md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
