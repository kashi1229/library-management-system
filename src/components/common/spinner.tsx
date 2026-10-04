"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared loading spinner. `Loader2` spins via CSS so it costs no JS, and the
 * label is announced politely for screen readers.
 */
export function Spinner({
  className,
  size = "md",
  label = "Loading",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}) {
  const dimension = { sm: "size-4", md: "size-5", lg: "size-8" }[size];

  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center", className)}>
      <Loader2 className={cn(dimension, "animate-spin text-muted-foreground motion-reduce:animate-none")} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Full-section spinner for route-level `loading.tsx` boundaries. */
export function LoadingPanel({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner size="lg" label={label} />
      <p className="text-small">{label}…</p>
    </div>
  );
}
