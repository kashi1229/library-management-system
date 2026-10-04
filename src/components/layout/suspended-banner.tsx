import * as React from "react";
import { TriangleAlert } from "lucide-react";

/**
 * Suspended-account banner.
 *
 * A suspended member keeps read access, so this is an explanation rather than a
 * blocker, and it is deliberately **not** dismissible — the restriction lasts
 * until an administrator reactivates the account, so hiding the reason would be
 * misleading. `role="status"` announces it once on arrival.
 */
export function SuspendedBanner({ reason }: { reason?: string | null }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-warning/30 bg-warning-soft px-4 py-3 text-small text-warning-ink lg:px-6"
    >
      <TriangleAlert className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">Your account is suspended.</p>
        <p className="leading-relaxed">
          You can browse the catalog and review your history, but borrowing, renewing and reserving are
          paused. {reason ? <>Reason: {reason}</> : "Please contact the library desk to reactivate it."}
        </p>
      </div>
    </div>
  );
}
