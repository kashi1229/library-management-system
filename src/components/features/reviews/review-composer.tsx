"use client";

import * as React from "react";
import { Loader2, Pencil, Star, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/common/form-alert";
import { StarPicker } from "@/components/features/reviews/star-picker";
import { reviewsApi, toErrorMessage, type ReviewSummary } from "@/lib/api-client";

/**
 * The review composer (spec 15).
 *
 * **One component creates and edits.** A separate "edit" form would be the same fields, the
 * same rules and the same submit — and two forms are two places for the character limit to
 * drift. Editing is seeded from the member's own review, which the service marks `isMine`.
 *
 * **Save is disabled until a rating is chosen, and the reason is in text.** A disabled
 * button with no explanation is the most common complaint about a review form, so the
 * requirement is stated beside the button rather than only in its state.
 *
 * **The server's eligibility refusal is shown, not paraphrased.** "Borrow this book first"
 * is a real rule with a real reason and a member deserves to read it. Refusals that are not
 * that rule go to a toast instead, because a field error for something the member cannot
 * fix looks like a stuck form.
 *
 * **After a save the draft is re-seeded from the server's copy**, not kept. Keeping the
 * local draft would let the form show a rating the server rounded or refused, and the next
 * edit would then submit something different from what is on screen.
 */
export function ReviewComposer({
  bookId,
  bookTitle,
  /** The caller's own review, or `null` when they have not written one. */
  mine,
  onSaved,
  className,
}: {
  bookId: string;
  bookTitle: string;
  mine: ReviewSummary | null;
  onSaved: () => void;
  className?: string;
}) {
  const editing = mine !== null;

  const [rating, setRating] = React.useState<number>(mine?.rating ?? 0);
  const [comment, setComment] = React.useState<string>(mine?.comment ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(!editing);

  /*
   * Re-seed when the server's version of `mine` changes — which is exactly once, right after
   * a save. Render-phase rather than in an effect, because an effect would paint the stale
   * values for one frame first. Keyed on the values themselves rather than on the object's
   * identity, since SWR returns a **new** object on every revalidation and an identity check
   * would discard a half-typed draft every time anything else refetched.
   */
  const incoming = `${mine?.id ?? ""}|${mine?.rating ?? 0}|${mine?.comment ?? ""}`;
  const [seed, setSeed] = React.useState(incoming);
  if (seed !== incoming) {
    setSeed(incoming);
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
    setOpen(true);
  }

  const discard = () => {
    setRating(mine?.rating ?? 0);
    setComment(mine?.comment ?? "");
    setError(null);
    setOpen(false);
  };

  const submit = async () => {
    if (rating < 1) return;

    setSaving(true);
    setError(null);

    try {
      await reviewsApi.upsert(bookId, {
        rating,
        // An emptied textarea is sent as `undefined`, not `""`. Sending `""` would store an
        // empty string the page then renders as a blank line under the stars, which reads
        // as a review with a missing comment rather than one with no comment.
        comment: comment.trim() === "" ? undefined : comment.trim(),
      });

      toast.success(editing ? "Review updated" : "Thanks for your review", {
        description: `“${bookTitle}” is now rated ${rating} out of 5.`,
      });

      onSaved();
    } catch (err) {
      const message = toErrorMessage(err, "Please try again.");
      if (/borrow/i.test(message)) {
        setError(message);
      } else {
        toast.error("Could not save your review", { description: message });
      }
    } finally {
      setSaving(false);
    }
  };

  if (editing && !open) {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-soft",
          className,
        )}
      >
        <span className="inline-flex items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              strokeWidth={1.5}
              className={cn(
                "size-4",
                index < (mine?.rating ?? 0) ? "fill-accent text-accent" : "text-border",
              )}
            />
          ))}
        </span>
        <span className="text-small text-muted-foreground">
          You rated this {mine?.rating} out of 5
          {mine?.comment ? " and left a comment." : "."}
        </span>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-4 shadow-soft sm:p-5",
        editing && "border-accent/40",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground">
          {editing ? "Your review" : "Rate this book"}
        </h3>
        {editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={discard}>
            <X className="size-3.5" aria-hidden="true" />
            Cancel edit
          </Button>
        ) : null}
      </div>

      <form
        className="mt-3 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? <FormAlert tone="danger" message={error} /> : null}

        <StarPicker
          name={`review-rating-${bookId}`}
          value={rating}
          onChange={setRating}
          hint="Required"
        />

        <Field
          label={
            <>
              Your review{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </>
          }
          htmlFor={`review-comment-${bookId}`}
          helper={
            comment.length > 900
              ? `Up to 1000 characters · ${1000 - comment.length} left`
              : "Up to 1000 characters. A rating on its own is plenty."
          }
        >
          <Textarea
            id={`review-comment-${bookId}`}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="What stayed with you?"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={rating < 1 || saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Star className="size-4" aria-hidden="true" />
            )}
            {saving ? "Saving…" : editing ? "Update review" : "Post review"}
          </Button>

          {editing ? (
            <Button type="button" variant="ghost" onClick={discard}>
              Discard changes
            </Button>
          ) : null}

          {/* The reason the button is dead, in text rather than only in its state. */}
          {rating < 1 ? (
            <p className="text-caption text-muted-foreground">
              Choose a rating to post your review.
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}