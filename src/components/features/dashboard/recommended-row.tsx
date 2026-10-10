import * as React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BookCover } from "@/components/common/book-cover";
import type { LoanBookRef } from "@/types";

/**
 * A horizontal shelf of book tiles.
 *
 * **One component serving both "Recommended for you" and "Your wishlist",** because they are the
 * same shape with different words, and two copies is two places for the tile to change.
 *
 * **A compact tile, not `BookCard`.** The catalog card carries availability pips, a rating and a
 * wishlist heart — three things that answer "should I borrow this?", which is the question the
 * catalog page exists for. On a dashboard shelf the job is "these are the books you might like",
 * and a member follows the link to decide. Putting the full card here would also have meant the
 * service returning `CatalogBook` rather than `LoanBookRef`, and a dashboard is a glance, not a
 * second catalog.
 *
 * **Scrolling, not wrapping, for the same reason `ReadingScroller` scrolls:** a row that wraps
 * turns into a grid and pushes the shelf below it off the screen.
 */
export function RecommendedRow({
  title,
  description,
  books,
  emptyTitle,
  emptyDescription,
  emptyAction,
  className,
}: {
  title: string;
  description?: string;
  books: LoanBookRef[];
  emptyTitle: string;
  emptyDescription: string;
  /** Optional call to action for the empty state. */
  emptyAction?: { label: string; href: string };
  className?: string;
}) {
  const headingId = React.useId();

  return (
    <section aria-labelledby={headingId} className={className}>
      {/* **Wraps, and the subtitle is allowed to shrink.** "Recommended for you" beside
          "Based on what you have borrowed" is 446px of text in a 296px column at 360px, and with
          `shrink-0` on the subtitle the pair pushed the document 115px wider than the viewport —
          a horizontal scrollbar on the member's own dashboard, caused by a caption. `flex-wrap`
          puts the caption on its own line instead. */}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id={headingId}
          className="font-display text-h2 font-semibold tracking-[-0.02em] text-foreground"
        >
          {title}
        </h2>
        {books.length > 0 && description ? (
          <p className="text-small text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {books.length === 0 ? (
        <Card className="p-0">
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent-ink"
            >
              <Compass className="size-5" strokeWidth={1.75} />
            </span>
            <p className="text-small font-medium text-foreground">{emptyTitle}</p>
            <p className="max-w-sm text-caption text-muted-foreground text-pretty">
              {emptyDescription}
            </p>
            {emptyAction ? (
              <Link
                href={emptyAction.href}
                className="mt-1 inline-flex h-10 items-center rounded-md bg-primary px-4 text-small font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {emptyAction.label}
              </Link>
            ) : null}
          </div>
        </Card>
      ) : (
        /* Negative side padding so the first tile aligns with the page gutter while the row still
           bleeds to the edge — a shelf whose first card is inset by its own scroll padding reads
           as misaligned rather than as a scroller. */
        <ul
          role="list"
          aria-label={title}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          {books.map((book) => (
            <li key={book.id} className="w-[10rem] shrink-0 snap-start sm:w-[11rem]">
              <BookTile book={book} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookTile({ book }: { book: LoanBookRef }) {
  // Empty slug means the book document is gone but the reference survives — a wishlist entry or
  // a past loan outliving the catalog row. Plain text, never a link to `/catalog/`.
  if (book.slug.length === 0) {
    return (
      <Card className="gap-2 p-2">
        <BookCover
          title={book.title}
          author={book.authors[0] ?? null}
          width={160}
          sizes="(max-width: 640px) 10rem, 11rem"
          className="h-[10rem] w-full"
        />
        <p className="line-clamp-2 text-caption text-muted-foreground">{book.title}</p>
      </Card>
    );
  }

  return (
    <Card className="h-full gap-2 p-2 transition-shadow hover:shadow-lift">
      <Link href={`/catalog/${book.slug}`} className="block space-y-2">
        <BookCover
          publicId={book.cover?.publicId ?? null}
          url={book.cover?.url ?? null}
          title={book.title}
          author={book.authors[0] ?? null}
          width={160}
          sizes="(max-width: 640px) 10rem, 11rem"
          className="h-[10rem] w-full"
        />
        <p className="line-clamp-2 text-caption text-medium text-foreground">{book.title}</p>
        <p className="line-clamp-1 text-caption text-muted-foreground">{book.authors[0]}</p>
        {/* No `sr-only` caption here either: the title already *is* the link's accessible name,
            and an absolutely-positioned span inside a horizontal scroller escapes its clip — the
            exact bug that put a 197px horizontal scrollbar on a 360px member dashboard. */}
      </Link>
    </Card>
  );
}