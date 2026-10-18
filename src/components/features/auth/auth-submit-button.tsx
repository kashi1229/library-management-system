"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The auth forms' submit button, in its two states.
 *
 * Two deliberate choices here:
 *
 * - **`disabled:opacity-100`.** The shared `Button` dims to 50% when disabled, which is right
 *   for a control that *cannot* be pressed and wrong for one that is *working*. At 50% the
 *   primary button renders `#FAF7F2` on roughly `#8D9E9A` — about 2.4:1, so the label becomes
 *   unreadable at exactly the moment the user is looking at it to see what is happening.
 * - **`aria-busy`.** `disabled` says "you may not press this"; `aria-busy` says "this is
 *   working". Only the second one describes a spinner, and it is what a screen reader needs.
 */
export function AuthSubmitButton({
  pending,
  idleLabel,
  pendingLabel,
  className,
}: {
  pending: boolean;
  /** Shown at rest. */
  idleLabel: string;
  /** Shown, and announced, while the submit is in flight. */
  pendingLabel: string;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      className={cn("w-full disabled:opacity-100", className)}
      disabled={pending}
      aria-busy={pending}
      data-pending={pending ? "" : undefined}
    >
      {pending ? (
        <>
          <Loader2
            className="size-4 animate-spin motion-reduce:animate-none"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {pendingLabel}
        </>
      ) : (
        idleLabel
      )}
    </Button>
  );
}
