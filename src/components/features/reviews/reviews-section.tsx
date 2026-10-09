"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { RatingSummaryPanel } from "@/components/features/reviews/rating-summary";
import { ReviewComposer } from "@/components/features/reviews/review-composer";
import { ModerationNote, ReviewRow } from "@/components/features/reviews/review-list";
import { reviewsApi, type ReviewSummary } from "@/lib/api-client";

/**
 * The Reviews section on the book detail page (F10, spec 15).
 *
 * ## Three audiences, one component
 *
 * A visitor reads the reviews and is invited to sign in; an eligible member gets the
 * composer; an ineligible member gets the reason. Deciding that here — from props the server
 * computed — is what stops the three from drifting into three opinions about who may review.
 *
 * ## Eligibility comes from the server, never from the client
 *
 * `canReview` says the member has borrowed this book. Re-deriving it here from the loan
 * list would be a second implementation of business rule 9, and the two would disagree the
 * first time a loan was returned while the page was open. The composer's own submit is
 * still guarded by the server, because a client-side preview is for *enabling* a control,
 * never for blocking one.
 *
 * **The composer is always seeded from `mine`**, which the endpoint returns on every page.
 * Finding the member's own review by scanning the visible rows instead would break for
 * anyone with more than ten reviews — they would see a composer offering to create a second
 * review of a book they have already reviewed.
 *
 * The list is client-fetched so posting updates the summary, the bars and the rows together
 * without a full page round trip. The rating on the *book card* is a separate server read,
 * so it catches up on the next navigation.
 *
 * This works signed out — the endpoint is public — which is what makes the sign-in
 * invitation worth showing.
 */
export function ReviewsSection({
  bookId,
  bookTitle,
  signedIn,
  role,
  canReview,
  className,
}: {
  bookId: string;
  bookTitle: string;
  signedIn: boolean;
  role: "admin" | "librarian" | "member";
  /** Server-derived from the `Loan` collection: at least one loan of this book, any state. */
  canReview: boolean;
  className?: string;
}) {
  const [page, setPage] = React.useState(1);

  const { data, error, isLoading, mutate } = useSWR(
    `/api/books/${bookId}/reviews?page=${page}&limit=10`,
    async () => reviewsApi.list(bookId, page, 10),
  );

  const summary = data?.data.summary;
  const items = data?.data.items ?? [];
  const mine = data?.data.mine ?? null;
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const shownPage = meta?.page ?? page;
  const isStaff = role === "admin" || role === "librarian";

  /**
   * Which review the composer is currently editing.
   *
   * `null` means "not editing" — which is also the state for a member who has no review yet,
   * because then there is nothing to seed it from. The composer's own open/closed state keeps
   * the two meanings apart.
   */
  const [editing, setEditing] = React.useState<ReviewSummary | null>(null);

  // Re-target the composer when the server's copy of the member's review changes — which is
  // once, after a save. Keyed on the values rather than the object identity, because SWR
  // returns a new object on every revalidation and an identity check would discard a
  // half-typed draft every time anything else refetched.
  /*
   * Closes the composer when the member's own review changes underneath it — after a save, or
   * after a delete elsewhere on the page — so the form cannot keep offering to edit a review
   * that is no longer theirs.
   */
  const seedKey = `${mine?.id ?? ""}|${mine?.rating ?? 0}|${mine?.comment ?? ""}`;
  const [seenSeed, setSeenSeed] = React.useState(seedKey);
  if (seenSeed !== seedKey) {
    setSeenSeed(seedKey);
    setEditing(null);
  }

  return (
    <section id="reviews" aria-labelledby="reviews-heading" className={className}>
      <h2
        id="reviews-heading"
        className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
      >
        Reviews
      </h2>

      <div className="mt-4 space-y-6">
        {/* ------------------------------ Summary ------------------------------ */}
        {error && !data ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-small text-danger-ink">
              {error instanceof Error ? error.message : "Something went wrong."}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => void mutate()}>
              Try again
            </Button>
          </div>
        ) : isLoading && !summary ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center" aria-busy="true">
            <div className="space-y-2">
              <Skeleton className="h-10 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex-1 space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-3 w-full" />
              ))}
            </div>
          </div>
        ) : summary ? (
          <RatingSummaryPanel summary={summary} />
        ) : null}

        {/* ----------------------------- Composer ----------------------------- */}
        {signedIn && canReview ? (
          <ReviewComposer
            bookId={bookId}
            bookTitle={bookTitle}
            mine={editing}
            onSaved={() => {
              setEditing(null);
              void mutate();
            }}
          />
        ) : signedIn ? (
          /* Ineligible: the reason in words, not a dead button. */
          <p className="rounded-lg border border-border bg-muted px-4 py-3 text-small text-muted-foreground">
            Borrow this book to leave a review. Ratings come from people who have actually
            read it.
          </p>
        ) : (
          <p className="text-small text-muted-foreground">
            <Link
              href={`/login?next=/catalog`}
              className="text-foreground underline underline-offset-2"
            >
              Sign in
            </Link>{" "}
            to rate this book or leave a comment.
          </p>
        )}

        {/* ------------------------------- List -------------------------------- */}
        {isStaff ? <ModerationNote /> : null}

        {items.length === 0 && !isLoading ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              icon={MessageSquare}
              title={summary && summary.count > 0 ? "No reviews on this page" : "No reviews yet"}
              description={
                summary && summary.count > 0
                  ? "There are more reviews on later pages."
                  : "Be the first to tell other readers what you made of this book."
              }
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((review) => (
              <ReviewRow
                key={review.id}
                review={review}
                onChanged={() => void mutate()}
                onEdit={setEditing}
              />
            ))}
          </ul>
        )}

        {/* --------------------------- Pagination ----------------------------- */}
        {totalPages > 1 ? (
          <nav
            aria-label="Reviews pagination"
            className="flex items-center justify-between gap-3 border-t border-border pt-4"
          >
            <p className="text-small text-muted-foreground">
              Page {shownPage} of {totalPages} · {meta?.total ?? 0}{" "}
              {(meta?.total ?? 0) === 1 ? "review" : "reviews"}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={shownPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={shownPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </Button>
            </div>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

/** The anchor a "Write a review" link points at, so it lands on the composer. */
export const REVIEWS_ANCHOR = "#reviews";