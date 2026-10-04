"use client";

import * as React from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Route-level error boundary.
 *
 * Shows a plain-language message and a retry — never a stack trace or a driver
 * error, which `handler()` already keeps out of API responses and which must not
 * leak into the UI either. `reset()` re-renders the segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Server-side detail stays in the terminal; the browser only needs the digest.
    console.error("[app] Unhandled render error:", error);
  }, [error]);

  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center py-20">
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-5 p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger-ink">
            <TriangleAlert className="size-6" strokeWidth={1.75} />
          </span>

          <div className="space-y-2">
            <h1 className="font-display text-h2 font-semibold tracking-[-0.02em] text-foreground">
              Something went wrong
            </h1>
            <p className="text-pretty text-body text-muted-foreground">
              We could not load this page. Try again — if the problem persists, the library desk can look
              into it.
            </p>
            {error.digest ? (
              <p className="font-mono text-code text-muted-foreground">Reference: {error.digest}</p>
            ) : null}
          </div>

          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button type="button" onClick={reset} className={cn(buttonVariants())}>
              <RefreshCw className="size-4" />
              Try again
            </button>
            <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline" }))}>
              Back to dashboard
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
