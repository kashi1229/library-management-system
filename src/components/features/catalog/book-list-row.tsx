"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BookCover } from "@/components/common/book-cover";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { StarRating } from "@/components/features/catalog/star-rating";
import { cn } from "@/lib/utils";
import type { CatalogBook } from "@/lib/api-client";

/**
 * One book as a horizontal row (F5 list mode).
 *
 * The list view exists for scanning metadata, so it shows the fields the grid
 * cannot: publication year, publisher and the first line of the description. The
 * description is clamped to two lines rather than truncated with an ellipsis in the
 * middle, so the reader still gets the sense of the book.
 */
export function BookListRow({
  book,
  className,
}: {
  book: CatalogBook;
  className?: string;
}) {
  return (
    <motion.article
      variants={rowItem}
      className={cn(
        "group relative flex gap-4 rounded-lg border border-border bg-surface p-3 sm:p-4",
        "transition-[box-shadow,border-color] duration-200 hover:border-foreground/20 hover:shadow-soft",
        className,
      )}
    >
      <Link
        href={`/catalog/${book.slug}`}
        className="flex flex-1 gap-4 focus-visible:outline-none"
      >
        <span className="sr-only">{book.title}</span>

        <BookCover
          publicId={book.cover?.publicId}
          url={book.cover?.url}
          title={book.title}
          author={book.authors[0]}
          categoryColor={book.category.color}
          width={160}
          sizes="64px"
          className="w-16 shrink-0 sm:w-20"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="line-clamp-2 text-small leading-snug font-medium text-foreground group-hover:underline group-hover:underline-offset-2">
              {book.title}
            </h3>
            <span className="text-caption text-muted-foreground">{book.authors.join(", ")}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
            <span className="font-medium text-foreground/80">{book.category.name}</span>
            {book.publishedYear ? <span>{book.publishedYear}</span> : null}
            {book.publisher ? <span className="truncate">{book.publisher}</span> : null}
            {book.pageCount ? <span>{book.pageCount} pages</span> : null}
          </div>

          {book.description ? (
            <p className="line-clamp-2 text-caption text-pretty text-muted-foreground/90">
              {book.description}
            </p>
          ) : null}

          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            <AvailabilityBadge
              available={book.effectiveAvailable}
              total={book.totalCopies}
              size="sm"
            />
            <StarRating value={book.ratingAvg} count={book.ratingCount} size="sm" />
          </div>
        </div>
      </Link>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-0 group-focus-within:shadow-[inset_0_0_0_2px_var(--color-ring)]"
      />
    </motion.article>
  );
}

const rowItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const } },
};