import { Activity, BookMarked, Clock, Library, Receipt } from "lucide-react";
import { CountUp } from "@/components/common/count-up";
import { Reveal } from "@/components/features/marketing/reveal";

/**
 * Industrial-grade stats milestone showcase.
 *
 * Displays live, authenticated database statistics:
 * 1. Catalogued book titles and physical shelf copies.
 * 2. Registered active student and faculty member accounts.
 * 3. 30-day circulating loan velocity.
 * 4. Automated 48-hour reservation hold window.
 *
 * Designed with concentric radius cards, tabular numeral alignment,
 * subtle top accent glow lines, and smooth scroll reveal.
 */
export function StatsBand({
  books,
  copies,
  members,
  loansThisMonth,
}: {
  books: number;
  copies: number;
  members: number;
  loansThisMonth: number;
}) {
  const figures = [
    {
      label: "Catalog Titles",
      value: books,
      suffix: "",
      detail: `${copies.toLocaleString("en-US")} total shelf copies`,
      Icon: Library,
    },
    {
      label: "Active Members",
      value: members,
      suffix: "",
      detail: "Registered student & faculty borrowers",
      Icon: BookMarked,
    },
    {
      label: "Monthly Circulation",
      value: loansThisMonth,
      suffix: "",
      detail: "Loans processed in the past 30 days",
      Icon: Receipt,
    },
    {
      label: "Hold Guarantee",
      value: 48,
      suffix: "h",
      detail: "Copy held for pickup upon return",
      Icon: Clock,
    },
  ];

  return (
    <section
      aria-labelledby="stats-heading"
      className="relative border-b border-border bg-muted/40 py-12 md:py-16"
    >
      <div className="container-page space-y-8">
        {/* Header Eyebrow with real-time audit note */}
        <Reveal className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5">
          <div className="flex items-center gap-2 text-caption font-semibold tracking-wider text-muted-foreground uppercase">
            <Activity className="size-4 text-success" aria-hidden="true" />
            <span>Circulation Health & Key Metrics</span>
          </div>
          <span className="text-caption text-muted-foreground">
            Directly synced with library catalog
          </span>
        </Reveal>

        <h2 id="stats-heading" className="sr-only">
          Library statistics and circulation velocity
        </h2>

        {/* 4-Column Metric Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {figures.map(({ label, value, suffix, detail, Icon }, index) => (
            <Reveal
              key={label}
              delay={index * 0.07}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-surface/90 p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lift"
            >
              {/* Subtle top indicator bar */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 bg-accent/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              />

              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-lg bg-accent-soft text-accent-ink transition-transform duration-200 group-hover:scale-105"
                >
                  <Icon strokeWidth={1.75} className="size-5" />
                </span>

                <span className="text-caption font-mono text-[11px] text-muted-foreground">
                  0{index + 1}
                </span>
              </div>

              <div className="mt-6">
                <p className="font-display text-3xl font-bold tracking-tight text-foreground tabular-nums sm:text-4xl">
                  <CountUp value={value} />
                  {suffix ? <span className="text-accent text-2xl font-normal ml-0.5">{suffix}</span> : null}
                </p>

                <p className="mt-1.5 text-small font-semibold text-foreground">
                  {label}
                </p>
                <p className="mt-0.5 text-caption text-muted-foreground leading-relaxed">
                  {detail}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}