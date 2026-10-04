"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useField } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Password input with a show/hide toggle.
 *
 * The toggle is a real `<button type="button">` inside the field's right edge,
 * so it is keyboard reachable and does not submit the form. `aria-pressed` and a
 * dynamic `aria-label` keep its state legible to screen readers.
 */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  const field = useField();

  const inputId = props.id ?? field?.id;

  return (
    <div className="relative">
      <Input
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        // `className` belongs to the input (callers use it to reserve icon room),
        // and `pr-12` makes space for the toggle on the right.
        className={cn("pr-12", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        tabIndex={0}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={inputId}
        onClick={() => setVisible((value) => !value)}
        className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
      </Button>
    </div>
  );
}
