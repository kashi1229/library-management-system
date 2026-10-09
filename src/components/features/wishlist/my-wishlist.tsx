"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { Heart, Library } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCover } from "@/components/common/book-cover";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { StarRating } from "@/components/features/catalog/star-rating";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { WishlistToggle } from "@/components/features/wishlist/wishlist-toggle";
import { reservationsApi, wishlistApi, toErrorMessage, type WishlistItem } from "@/lib/api-client";

/**
 * The member's reading list, `/wishlist` (F10, spec 15).
 *
 * **A grid of the same book cards the catalog uses**, because a saved book should look like
 * the book it is. Each card adds the one thing a reading list needs that the catalog does not:
 * a **Reserve** button, shown only where it can work — the book has no effective copy and the
 * member is not already in its queue.
 *
 * **Reserve is inline and honest about its refusals.** The check is a preview, computed from
 * what the page already knows; the server still decides, and its sentence replaces the toast.
 * A button that appears to reserve and then says "you already have this on loan" teaches the
 * reader to distrust every button on the page.
 *
 * **Removing is optimistic.** The card disappears at once and comes back with a toast if the
 * request failed — removing from a reading list is a decision you should be able to make
 * quickly, and a card that lingers for a second reads as "it did not work".
 *
 * `GET /api/wishlist` takes no member id (invariant 3) and returns the books through the
 * **catalog reader**, so availability here already subtracts ready holds — the same number
 * the catalog card shows.
 */
export function MyWishlist() {
  const { data, error, isLoading, mutate } = useSWR("/api/wishlist", async () =>
    wishlistApi.list(),
  );

  const items = data ?? [];

  /**
   * Optimistic removal: the card leaves at once, and comes straight back if the server
   * refuses.
   *
   * Doing both halves inside the `mutate` updater rather than around it means there is only
   * one place that decides what the list now is — returning the previous array on failure is
   * the rollback, so no second write is needed and the two cannot disagree.
   */
  const remove = async (item: WishlistItem) => {
    await mutate(
      async (current) => {
        const remaining = (current ?? []).filter((row) => row.id !== item.id);

        try {
          await wishlistApi.remove(item.book._id);
          return remaining;
        } catch (err) {
          toast.error("Could not remove that book", {
            description: toErrorMessage(err, "Please try again."),
          });
          return current;
        }
      },
      { revalidate: false },
    );
  };

  return (
    <div className="container-page space-y-8">
      <PageHeader
        title="Wishlist"
        description="Books you are keeping an eye on. Save them here and pick them up when you are ready."
        action={
          <Button asChild variant="outline">
            <Link href="/catalog">
              <Library className="size-4" aria-hidden="true" />
              Browse the catalog
            </Link>
          </Button>
        }
      />

      {error && !data ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Heart}
            title="Could not load your reading list"
            description={error instanceof Error ? error.message : "Something went wrong."}
            action={
              <Button onClick={() => void mutate()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : isLoading && items.length === 0 ? (
        <WishlistSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Heart}
            title="Your reading list is waiting."
            description="Tap the heart on any book to keep it here. Nothing is reserved and nothing expires — it is just your list."
            action={
              <Button asChild>
                <Link href="/catalog">Find something to read</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <p aria-live="polite" className="text-small text-muted-foreground">
            {items.length} {items.length === 1 ? "book" : "books"} saved
          </p>

          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item) => (
              <WishlistCard key={item.id} item={item} onRemove={() => void remove(item)} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * One saved book.
 *
 * **Reserve appears only where it can work**, and "can work" is decided from what the page
 * already has: no effective copy, and the member is not already waiting for it. A Reserve
 * button that is disabled still costs the reader a decision — it says "not now" without
 * saying why, which is worse than not offering it.
 */
function WishlistCard({
  item,
  onRemove,
}: {
  item: WishlistItem;
  onRemove: () => void;
}) {
  const [reserving, setReserving] = React.useState(false);
  const book = item.book;

  // The wishlist response does not carry `userState`, so the queue position is not known
  // here. Reserve is therefore offered whenever nothing is free, and the server's refusal
  // ("you already reserved this book") is what covers the rest. Guessing from a value that
  // is not present would mean an optimistic button that is wrong about half the time.
  const canReserve = book.effectiveAvailable === 0 && book.status === "active";

  const reserve = async () => {
    setReserving(true);
    try {
      await reservationsApi.reserve(book._id);
      toast.success("Reserved", {
        description: `We will hold the next copy of “${book.title}” that comes back.`,
      });
    } catch (error) {
      // The server's sentence names the rule — including "you already reserved this book" —
      // and replaces the toast text rather than being wrapped in a second layer of wording.
      toast.error("Could not reserve this book", {
        description: toErrorMessage(error, "Please try again."),
      });
    } finally {
      setReserving(false);
    }
  };

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-soft transition-shadow hover:shadow-lift">
      <Link href={`/catalog/${book.slug}`} className="flex flex-1 flex-col focus-visible:outline-none">
        <span className="sr-only">{book.title}</span>

        <div className="relative">
          <BookCover
            publicId={book.cover?.publicId}
            url={book.cover?.url}
            title={book.title}
            author={book.authors[0]}
            categoryColor={book.category.color}
            width={320}
            sizes="(max-width: 640px) 45vw, 240px"
            className="w-full rounded-none border-b border-border"
          />

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

      {/* The heart and Reserve sit outside the anchor, or a tap would navigate. */}
      <div className="flex items-center gap-1.5 border-t border-border p-2.5">
        {canReserve ? (
          <Button
            type="button"
            size="sm"
            variant="accent"
            className="flex-1"
            disabled={reserving}
            onClick={reserve}
          >
            {reserving ? "Reserving…" : "Reserve"}
          </Button>
        ) : (
          <p className="flex-1 ps-1 text-caption text-muted-foreground">
            {book.effectiveAvailable > 0 ? "Available to borrow" : "Archived"}
          </p>
        )}

        <WishlistToggle
          bookId={book._id}
          bookTitle={book.title}
          initialSaved
          signedIn
          onChanged={(saved) => {
            if (!saved) onRemove();
          }}
        />
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-0 transition-[box-shadow] group-focus-within:shadow-[inset_0_0_0_2px_var(--color-ring)]"
      />
    </li>
  );
}

/** Skeleton matching the card's real footprint, so the grid does not jump. */
function WishlistSkeleton() {
  return (
    <ul
      className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5")}
      aria-busy="true"
      aria-label="Loading your reading list"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="overflow-hidden rounded-lg border border-border bg-surface">
          <Skeleton className="aspect-[2/3] w-full rounded-none" />
          <div className="space-y-2 p-3.5">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}