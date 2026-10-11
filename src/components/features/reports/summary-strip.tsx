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

const TONE_BG = {
  default: "border-border bg-surface",
  success: "border-success/30 bg-success-soft/20",
  warning: "border-warning/30 bg-warning-soft/20",
  danger: "border-danger/30 bg-danger-soft/20",
} as const;

const TONE_DOT = {
  default: "bg-muted-foreground/40",
  success: "bg-success-ink",
  warning: "bg-warning-ink",
  danger: "bg-danger-ink",
} as const;

export function SummaryStrip({ items }: { items: ReportSummaryItem[] }) {
  if (items.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const tone = item.tone ?? "default";
        return (
          <div
            key={item.label}
            className={cn(
              "group relative overflow-hidden rounded-xl border p-4 shadow-xs transition-all duration-200 hover:shadow-soft",
              "print:border-border print:bg-transparent print:shadow-none",
              TONE_BG[tone],
            )}
          >
            <dt className="flex items-center gap-1.5 text-caption font-medium">
              <span className={cn("size-1.5 shrink-0 rounded-full", TONE_DOT[tone])} aria-hidden="true" />
              <span className={cn("truncate", TONE_LABEL[tone])}>
                {item.label}
              </span>
            </dt>
            <dd
              className={cn(
                "mt-2 break-words font-display text-h3 font-semibold tracking-tight tabular-nums",
                TONE_VALUE[tone],
              )}
            >
              {item.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}