"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Switch as SwitchPrimitive } from "radix-ui";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-input bg-muted",
        "transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/45",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[size=default]:h-6 data-[size=default]:w-11",
        "data-[size=sm]:h-5 data-[size=sm]:w-9",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        // Keep the 24px visual track but grow the pointer target to 40px,
        // per code-standards.md "Touch targets ≥ 40px".
        "before:absolute before:inset-x-0 before:-inset-y-[8px] before:content-['']",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-surface shadow-soft ring-0",
          "transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "group-data-[size=default]/switch:size-5 group-data-[size=default]/switch:translate-x-0.5",
          "group-data-[size=sm]/switch:size-4 group-data-[size=sm]/switch:translate-x-0.5",
          "group-data-[size=default]/switch:data-[state=checked]:translate-x-[1.375rem]",
          "group-data-[size=sm]/switch:data-[state=checked]:translate-x-[1.125rem]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
