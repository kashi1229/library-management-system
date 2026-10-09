"use client";

import * as React from "react";
import { Loader2, ShieldX, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { reviewsApi, toErrorMessage, type ReviewSummary } from "@/lib/api-client";
import { formatDate, initials } from "@/lib/utils";

/**
 * One review on the book page (spec 15).
 *
 * **Whose controls appear is decided by the server**, via `isMine` / `canModerate`. A
 * component that compared ids itself would offer "Delete" on somebody else's review and then
 * watch the API refuse — a control that is shown and then says no.
 *
 * **A staff removal says what it did.** Removing a review changes the book's average and
 * count, which every catalog card then shows; the confirmation therefore reports the new
 * rating rather than a bare "removed", because that is the consequence the librarian is
 * actually taking.
 *
 * The member's own row gets **Edit** (which re-opens the composer above) as well as Delete,
 * so nothing requires scrolling back up to change a rating.
 */
export function ReviewRow({
  review,
  onChanged,
  onEdit,
  className,
}: {
  review: ReviewSummary;
  onChanged: () => void;
  onEdit: (review: ReviewSummary) => void;
  className?: string;
}) {
  const [confirming, setConfirming] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  // Moderation is offered on your own review too if you are staff — but the *edit*
  // control is not, because editing your own review and moderating it are different acts and
  // a reviewer removing their own words is not moderation.
  const canModerate = review.canModerate && !review.isMine;

  const remove = async () => {
    setRemoving(true);
    try {
      const summary = await reviewsApi.remove(review.id);
      toast.success("Review removed", {
        description:
          summary.count === 0
            ? "This book has no ratings left."
            : `The book is now rated ${summary.average.toFixed(1)} out of 5 from ${summary.count} ${summary.count === 1 ? "rating" : "ratings"}.`,
      });
      onChanged();
    } catch (error) {
      toast.error("Could not remove that review", {
        description: toErrorMessage(error, "Please try again."),
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <li
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-soft",
        review.isMine && "border-accent/40",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="text-caption">
            {review.member.avatar ? "" : initials(review.member.name)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          {/*
            * The stars and the date are kept in one `whitespace-nowrap` group. They describe the
            * same review, and letting them wrap independently at 390px tore the row into three
            * lines — name, then stars, then a date on its own — which reads as three separate
            * facts rather than one review. As a unit they wrap together onto a second line, or
            * not at all.
            */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-small font-medium text-foreground">{review.member.name}</span>
            {review.isMine ? (
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-caption font-medium text-accent-ink">
                You
              </span>
            ) : null}

            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              {/* Stars are decorative here; the sentence below is the accessible rating. */}
              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <Star
                    key={index}
                    strokeWidth={1.5}
                    className={cn(
                      "size-3.5",
                      index < review.rating ? "fill-accent text-accent" : "text-border",
                    )}
                  />
                ))}
              </span>

              <span className="text-caption text-muted-foreground">
                {review.updatedAt !== review.createdAt ? "Edited " : ""}
                {formatDate(review.updatedAt)}
              </span>

              <span className="sr-only">{review.rating} out of 5 stars</span>
            </span>
          </div>

          {review.comment ? (
            <p className="mt-2 text-small text-pretty text-foreground">{review.comment}</p>
          ) : (
            /* No empty gap where a comment would be — "rated it, wrote nothing" is itself
               the information. */
            <p className="mt-2 text-small text-muted-foreground italic">No comment left.</p>
          )}
        </div>

        {(review.isMine || canModerate) ? (
          <div className="flex shrink-0 items-center gap-1">
            {review.isMine ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(review)}
                aria-label="Edit your review"
              >
                Edit
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="icon-sm"
              disabled={removing}
              onClick={() => setConfirming(true)}
              aria-label={
                canModerate
                  ? `Remove ${review.member.name}'s review of this book`
                  : "Delete your review"
              }
              className="text-danger-ink hover:bg-danger-soft"
            >
              {removing ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) setConfirming(false);
        }}
        title={canModerate ? "Remove this review?" : "Delete your review?"}
        consequence={
          canModerate
            ? `${review.member.name}'s rating of ${review.rating} out of 5 will be removed, and the book's average and rating count will change. This is recorded in the audit log.`
            : "Your rating and comment will be removed from this book. The book's average and rating count will change."
        }
        confirmLabel={canModerate ? "Remove review" : "Delete review"}
        onConfirm={remove}
      />
    </li>
  );
}

/** The moderation hint above the list, so "Remove" is never a surprise. */
export function ModerationNote({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-caption text-muted-foreground",
        className,
      )}
    >
      <ShieldX className="size-3.5 shrink-0" aria-hidden="true" />
      You are viewing as a staff member, so you can remove any review. Removals are recorded in
      the audit log.
    </p>
  );
}