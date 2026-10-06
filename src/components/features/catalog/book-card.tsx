"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BookCover } from "@/components/common/book-cover";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { StarRating } from "@/components/features/catalog/star-rating";
import { cn } from "@/lib/utils";
import type { CatalogBook } from "@/lib/api-client";

/**
 * One book in the catalog grid (F5).
 *
 * The **whole card** is the link, not just the title. A card-sized target is the
 * difference between a comfortable grid and a fiddly one on a phone, and a title-only
 * target is the classic catalog usability complaint.
 *
 * The cover reserves its 2:3 box before the image arrives (`BookCover` is
 * `aspect-[2/3]`), so a slow image causes no layout shift.
 *
 * Availability is overlaid on the cover rather than listed under the title: it is the
 * reason a reader picks one card over another, so it should be visible without
 * reading the metadata.
 */
export function BookCard({
  book,
  priority = false,
  className,
}: {
  book: CatalogBook;
  /** `true` for the first row, so `next/image` can eagerly load the LCP candidate. */
  priority?: boolean;
  className?: string;
}) {
  const href = `/catalog/${book.slug}`;

  return (
    <motion.article
      variants={fadeUpItem}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface",
        "shadow-soft transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {/* Stretched link: one anchor covering the card, so the whole surface is the
          target while the accessible name stays the book's title. */}
      <Link href={href} className="flex flex-1 flex-col focus-visible:outline-none">
        <span className="sr-only">{book.title}</span>

        <div className="relative">
          <BookCover
            publicId={book.cover?.publicId}
            url={book.cover?.url}
            title={book.title}
            author={book.authors[0]}
            categoryColor={book.category.color}
            width={400}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
            priority={priority}
            className="w-full rounded-none border-b border-border"
          />

          {/* Availability, overlaid bottom-left on the cover. A scrim keeps it legible
              over artwork of any brightness. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2.5">
            <span className="inline-flex rounded-full bg-background/92 px-2 py-1 backdrop-blur-sm">
              <AvailabilityBadge
                available={book.effectiveAvailable}
                total={book.totalCopies}
                size="sm"
                className="text-foreground"
              />
            </span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <h3 className="line-clamp-2 text-small leading-snug font-medium text-pretty text-foreground group-hover:underline group-hover:underline-offset-2">
            {book.title}
          </h3>
          <p className="line-clamp-1 text-caption text-muted-foreground">{book.authors.join(", ")}</p>

          <div className="mt-auto pt-1">
            <StarRating value={book.ratingAvg} count={book.ratingCount} size="sm" showValue={false} />
          </div>
        </div>
      </Link>

      {/* Focus ring on the card, not the inner anchor, so the indicator matches the
          shape the user perceives as the target. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-0 transition-[box-shadow] group-focus-within:shadow-[inset_0_0_0_2px_var(--color-ring)]"
      />
    </motion.article>
  );
}

/** Shared entrance. Kept local so the grid can wrap every card in one stagger. */
export const fadeUpItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } },
};