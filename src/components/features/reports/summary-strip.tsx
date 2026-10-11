import { cn } from "@/lib/utils";
import type { ReportSummaryItem } from "@/types";

/**
 * The 3–4 figures above a report's table.
 *
 * **`tone` is only ever applied when the figure is non-zero** — the service decides that, not this
 * component. A red "0 overdue" teaches a librarian to stop reading red, which is the same reason
 * the staff dashboard's KPI cards only take a tone when the number means something.
 *
 * **Print styling matters here more than anywhere else.** A report is frequently printed, and the
 * summary is the part somebody actually reads on paper, so it survives the print stylesheet in
 * ink-on-white and keeps its box.
 */
const TONE_VALUE = {
  default: "text-foreground",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
} as const;

const TONE_LABEL = {
  default: "text-muted-foreground",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
} as const;

export function SummaryStrip({ items }: { items: ReportSummaryItem[] }) {
  if (items.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-border bg-surface px-4 py-3 print:border-border print:bg-transparent"
        >
          <dt className={cn("text-caption font-medium", TONE_LABEL[item.tone ?? "default"])}>
            {item.label}
          </dt>
          {/* `tabular-nums` and a `break-words` wrapper: the busiest title in the popular report
              can be a full sentence, and a value that overflows its card turns the strip into
              the one element on the page that scrolls sideways. */}
          <dd
            className={cn(
              "mt-1 break-words font-display text-h3 font-semibold tracking-[-0.02em] tabular-nums",
              TONE_VALUE[item.tone ?? "default"],
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}