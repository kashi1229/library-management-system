import Link from "next/link";
import { ArrowUpRight, BookOpen, Layers } from "lucide-react";
import { CategoryIconTile } from "@/components/common/category-icon-tile";
import { Reveal } from "@/components/features/marketing/reveal";
import { SectionEyebrow } from "@/components/features/marketing/section-eyebrow";
import { ROUTES } from "@/lib/constants";
import type { CategorySummary } from "@/types";

/**
 * Editorial Category & Shelf Explorer.
 *
 * Capabilities:
 * - Direct filtering into the catalog with pre-selected category ID.
 * - Dynamic category swatch tile styling matching the design tokens.
 * - Subtle ambient color highlight and left border transition on hover.
 * - Clean responsive grid with concentric card borders and optical icon alignment.
 */
export function CategoryShowcase({
  categories,
  hidden,
}: {
  categories: CategorySummary[];
  hidden: number;
}) {
  if (categories.length === 0) return null;

  const total = categories.length + hidden;

  return (
    <section aria-labelledby="categories-heading" className="relative py-16 md:py-24">
      <div className="container-page space-y-10">
        {/* Section Header */}
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <SectionEyebrow>Curated Disciplines</SectionEyebrow>
            <h2
              id="categories-heading"
              className="text-balance font-display text-h1 font-semibold tracking-[-0.02em] text-foreground"
            >
              Explore by academic shelf
            </h2>
            <p className="text-pretty text-body text-muted-foreground">
              Every shelf opens the catalog pre-filtered to that discipline. Discover textbooks,
              foundational monographs, and peer-reviewed acquisitions.
            </p>
          </div>

          <Link
            href={ROUTES.catalog}
            className="group inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-small font-medium text-foreground shadow-sm transition-all hover:border-primary/40 hover:bg-muted hover:shadow focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
          >
            <span>Explore all {total} shelves</span>
            <ArrowUpRight
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4 text-accent transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        </Reveal>

        {/* Shelf Cards Grid */}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Reveal
              key={category._id}
              as="li"
              delay={Math.min(index, 8) * 0.05}
              className="min-w-0"
            >
              <Link
                href={`${ROUTES.catalog}?category=${category._id}`}
                className="group relative flex h-full min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
              >
                {/* Left accent slide bar */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 start-0 w-1 -translate-x-full bg-accent transition-transform duration-200 group-hover:translate-x-0 motion-reduce:transition-none"
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <CategoryIconTile icon={category.icon} color={category.color} />
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <BookOpen className="size-3" aria-hidden="true" />
                      <span className="tabular-nums">{category.bookCount}</span>
                      <span>{category.bookCount === 1 ? "vol" : "vols"}</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-balance font-display text-h3 leading-tight font-semibold tracking-[-0.02em] text-foreground transition-colors group-hover:text-accent-ink">
                      {category.name}
                    </h3>
                    {category.description ? (
                      <p className="mt-1.5 line-clamp-2 text-small text-pretty text-muted-foreground leading-relaxed">
                        {category.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-caption font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  <span>Browse shelf</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 text-accent transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </div>
              </Link>
            </Reveal>
          ))}
        </ul>

        {hidden > 0 ? (
          <Reveal as="div" className="flex items-center gap-2 text-small text-muted-foreground">
            <Layers className="size-4 text-accent-ink" aria-hidden="true" />
            <span>
              Showing {categories.length} of {total} populated academic shelves. More available in the catalog.
            </span>
          </Reveal>
        ) : null}
      </div>
    </section>
  );
}