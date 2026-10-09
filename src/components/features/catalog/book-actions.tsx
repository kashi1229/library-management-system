"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Link2,
  Loader2,
  PackageCheck,
  Share2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { reservationsApi, toErrorMessage } from "@/lib/api-client";
import { WishlistToggle } from "@/components/features/wishlist/wishlist-toggle";
import type { CatalogBookDetail } from "@/types";

/**
 * Reserve / Wishlist / Share on the detail page (F5, F8, F10).
 *
 * ## Reserve is live
 *
 * Unit 14 wired this control, so it now does the real thing rather than explaining what it
 * would do. The four states are the four answers the question can have, and each says what
 * the reader has to do next:
 *
 * - **A copy is on the shelf** → "Borrow at the desk". Reserving would be wrong: rule 5 only
 *   permits it when there is no effective copy, and a copy sitting there is a copy they can
 *   have today. The button links to the desk rather than dead-ending.
 * - **No copy, and they hold nothing** → "Reserve this book", plus the place they would get.
 *   A number is what makes joining a queue a decision rather than a leap of faith, and it
 *   comes from the server rather than being invented here.
 * - **Waiting** → their live position, and a working Cancel. Cancelling a `ready` hold really
 *   does put the copy back on the shelf, so pretending it worked would leave the book
 *   reading "all copies out" to everyone else.
 * - **Ready** → a success panel with the server's countdown, because that is the only state
 *   on this page that requires the reader to *do* something.
 *
 * ## Wishlist is live too
 *
 * Unit 15 replaced the disabled placeholder with a real, optimistic heart. Its state comes
 * from `userState.wishlisted`, which the server already computes from the session, so it is
 * right on the first paint with no client fetch.
 *
 * Share works today, via the Web Share API on a touch device and a clipboard copy everywhere
 * else.
 */
export function BookActions({
  book,
  signedIn,
  className,
}: {
  book: CatalogBookDetail;
  signedIn: boolean;
  className?: string;
}) {
  const router = useRouter();

  const reservation = book.userState.reservation;
  const ready = reservation === "ready";
  const waiting = reservation === "waiting";
  const borrowed = book.userState.activeLoan;

  const [cancelling, setCancelling] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const reserve = async () => {
    try {
      await reservationsApi.reserve(book._id);
      toast.success("Reserved", {
        description: `We will hold the next copy of “${book.title}” that comes back.`,
      });
      router.refresh();
    } catch (error) {
      // The server's sentence names the rule that refused it — "Copies are available", "you
      // already have this on loan", the limit. It replaces the button's preview rather than
      // being wrapped in a second layer of wording.
      toast.error("Could not reserve this book", {
        description: toErrorMessage(error, "Please try again."),
      });
      // A refusal can also mean the world changed under the page (a copy came back), so the
      // availability and queue figures on screen are re-read rather than left stale.
      router.refresh();
    }
  };

  const cancel = async () => {
    const holdId = book.userState.reservationId;
    if (!holdId) return;

    setCancelling(true);
    try {
      await reservationsApi.cancel(holdId);
      toast.success(ready ? "Hold released" : "Reservation cancelled", {
        description: ready
          ? `“${book.title}” is available to borrow again.`
          : `You are no longer waiting for “${book.title}”.`,
      });
      router.refresh();
    } catch (error) {
      toast.error("Could not cancel that reservation", {
        description: toErrorMessage(error, "Please try again."),
      });
    } finally {
      setCancelling(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    const payload = { title: book.title, url };

    // Native share on a device that has it; clipboard everywhere else.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch {
        // Cancelled by the user, or the payload was rejected. Fall through.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", { description: "Paste it anywhere to share this book." });
    } catch {
      toast.error("Could not copy the link");
    }
  };

  const place = book.userState.reservationPosition;
  // The place they would get if they joined now. `null` while they already hold something —
  // there is no "would be" for a book they are already in the queue for.
  const nextPlace = reservation ? null : book.queueLength + 1;

  return (
    <div className={cn("space-y-3", className)}>
      {/*
        * The ready panel sits **above** the buttons, not instead of them. It is the only
        * state that requires an action, so it is the only one that gets a success tint; the
        * buttons stay in the same place in every state, which is what stops the layout
        * jumping as a reader moves along the queue.
        */}
      {ready ? (
        <div
          role="status"
          className="rounded-lg border border-success/40 bg-success-soft px-4 py-3"
        >
          <p className="flex items-center gap-2 font-display text-h3 font-semibold tracking-[-0.02em] text-success-ink">
            <PackageCheck className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            Ready for pickup
          </p>
          <p className="mt-1 text-small text-success-ink">
            {book.userState.readyHoldHours !== null
              ? `A copy is being held at the desk for ${book.userState.readyHoldHours} ${book.userState.readyHoldHours === 1 ? "hour" : "hours"} more.`
              : "A copy is being held at the desk for you."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {signedIn ? (
          ready ? (
            <Button asChild variant="default">
              <Link href="/my-loans">
                <BookmarkCheck className="size-4" aria-hidden="true" />
                On your loans
              </Link>
            </Button>
          ) : waiting ? (
            <Button variant="outline" disabled title="You are already in this queue">
              <BookmarkCheck className="size-4" aria-hidden="true" />
              {place ? `You are #${place} in line` : "Reserved"}
            </Button>
          ) : borrowed ? (
            <Button variant="outline" disabled title="You currently have this book on loan">
              <BookmarkCheck className="size-4" aria-hidden="true" />
              On loan to you
            </Button>
          ) : book.effectiveAvailable > 0 ? (
            <Button asChild>
              <Link href={ROUTES.staff.circulation}>
                <Bookmark className="size-4" aria-hidden="true" />
                Borrow at the desk
              </Link>
            </Button>
          ) : (
            <Button variant="accent" onClick={() => void reserve()}>
              <Bookmark className="size-4" aria-hidden="true" />
              Reserve this book
            </Button>
          )
        ) : (
          <Button asChild variant={book.effectiveAvailable > 0 ? "default" : "accent"}>
            <Link href={`${ROUTES.login}?next=/catalog/${book.slug}`}>
              <Bookmark className="size-4" aria-hidden="true" />
              {book.effectiveAvailable > 0 ? "Sign in to borrow" : "Sign in to reserve"}
            </Link>
          </Button>
        )}

        {signedIn && (waiting || ready) && book.userState.reservationId ? (
          <Button variant="ghost" disabled={cancelling} onClick={() => void cancel()}>
            {cancelling ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Bookmark className="size-4" aria-hidden="true" />
            )}
            {cancelling ? "Cancelling…" : "Cancel reservation"}
          </Button>
        ) : null}

        {/*
         * Wishlist. **Unit 15 wired this**, so it is a real control rather than the disabled
         * placeholder it used to be — and it sits above the Add-to-wishlist row's old
         * position because it is now an action rather than a notice.
         *
         * `book.userState.wishlisted` is computed server-side from the session, so the
         * initial state is right on the first paint with no client fetch.
         */}
        {signedIn ? (
          <WishlistToggle
            bookId={book._id}
            bookTitle={book.title}
            initialSaved={book.userState.wishlisted}
            signedIn={signedIn}
            variant="button"
          />
        ) : null}

        <Button variant="ghost" onClick={share}>
          {copied ? (
            <Check className="size-4 text-success-ink" aria-hidden="true" />
          ) : (
            <Share2 className="size-4" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Share"}
        </Button>
      </div>

      {!signedIn ? (
        <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Link2 className="size-3.5" aria-hidden="true" />
          Sign in to reserve books and track what you have borrowed.
        </p>
      ) : null}

      {/* The queue, in one sentence, with the reader's own place called out. */}
      {book.queueLength > 0 ? (
        <p className="flex items-start gap-1.5 text-caption text-muted-foreground">
          <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {waiting && place ? (
            <>
              You are <span className="font-medium text-foreground">#{place}</span> of{" "}
              {book.queueLength} {book.queueLength === 1 ? "person" : "people"} in the queue for
              this book.
            </>
          ) : ready ? (
            <>
              {book.queueLength} {book.queueLength === 1 ? "reader is" : "readers are"} behind
              you in the queue for this book.
            </>
          ) : (
            <>
              {book.queueLength} {book.queueLength === 1 ? "person is" : "people are"} already
              waiting. {nextPlace ? `Reserving now would put you at #${nextPlace}.` : ""}
            </>
          )}
        </p>
      ) : !signedIn ? null : (
        book.effectiveAvailable === 0 && !borrowed ? (
          <p className="text-caption text-muted-foreground">
            Every copy is on loan and nobody is waiting. Reserving now puts you first in line.
          </p>
        ) : null
      )}
    </div>
  );
}