import * as React from "react";
import { cn } from "@/lib/utils";
import { useField } from "@/components/ui/field";

function Textarea({ className, id, ...props }: React.ComponentProps<"textarea">) {
  const field = useField();

  return (
    <textarea
      id={id ?? field?.id}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-surface px-3.5 py-2.5",
        "text-body text-foreground transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-muted-foreground/70 field-sizing-content",
        "focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger aria-invalid:ring-danger/25",
        "md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
