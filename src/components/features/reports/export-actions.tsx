"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReportType } from "@/lib/constants";
import type { ReportFilters } from "@/lib/api-client";
import { reportsApi } from "@/lib/api-client";

/**
 * Export CSV and Print.
 *
 * **The CSV is a plain `<a href>`, not a `fetch` + blob.** A download has to carry the server's
 * `Content-Disposition` filename through to the browser, and re-deriving that filename in the
 * browser is how a file called `download` ends up on somebody's desktop. The anchor also streams
 * to disk instead of loading the whole report into a tab's memory first, and it inherits the
 * session cookie automatically — which a hand-rolled `fetch` would have to remember to do.
 *
 * **The link carries the current filters**, read straight out of the URL. That is the real reason
 * the report filters are URL-synced rather than component state: an export can never disagree
 * with the screen it was downloaded from, because they are the same query.
 *
 * **Both buttons are `type="button"`.** Inside a `<form>` a button with no type submits it, and a
 * report page that reloads when somebody clicks "Print" is a memorable bug.
 */
export function ExportActions({
  type,
  filters,
  className,
}: {
  type: ReportType;
  filters: ReportFilters;
  className?: string;
}) {
  const csvHref = reportsApi.csvUrl(type, filters);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button asChild variant="outline" size="sm">
        <a href={csvHref} download>
          <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Export CSV
        </a>
      </Button>

      {/* `onClick` on a button rather than `window.print()` in an effect: the browser's own
          print dialog must open from a user gesture, and calling it from an effect after mount
          is blocked. */}
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Print
      </Button>
    </div>
  );
}