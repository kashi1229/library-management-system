"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Check, Link2, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import type { CatalogBookDetail } from "@/types";

/**
 * Reserve / Wishlist / Share on the detail page (F5).
 *
 * **Nothing here is wired yet, and the UI says so honestly.** Reserve is Unit 14 and
 * the wishlist is Unit 15. Rather than shipping buttons that quietly do nothing —
 * the single most frustrating thing a demo can contain — each control explains what it
 * will do and, for a visitor, offers the sign-in that unblocks it.
 *
 * Share is the exception: it works today, via the Web Share API on a touch device and
 * a clipboard copy everywhere else, and it is genuinely useful for a library catalog.
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
  const reserved = book.userState.reservation !== null;
  const borrowed = book.userState.activeLoan;

  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

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

  const primary = reserved
    ? { label: "Reserved", icon: Check, tone: "default" as const }
    : borrowed
      ? { label: "On loan to you", icon: BookmarkCheck, tone: "outline" as const }
      : book.effectiveAvailable > 0
        ? { label: "Borrow at the desk", icon: Bookmark, tone: "default" as const }
        : { label: "Reserve this book", icon: Bookmark, tone: "accent" as const };

  const PrimaryIcon = primary.icon;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap gap-2">
        {signedIn ? (
          <Button
            variant={primary.tone}
            disabled
            title={
              reserved
                ? "You have a reservation for this book"
                : borrowed
                  ? "You currently have this book on loan"
                  : "Reservations open in a later release"
            }
            className="cursor-not-allowed"
          >
            <PrimaryIcon className="size-4" aria-hidden="true" />
            {primary.label}
          </Button>
        ) : (
          <Button asChild variant={primary.tone}>
            <Link href={`${ROUTES.login}?next=/catalog/${book.slug}`}>
              <Bookmark className="size-4" aria-hidden="true" />
              {book.effectiveAvailable > 0 ? "Sign in to borrow" : "Sign in to reserve"}
            </Link>
          </Button>
        )}

        {signedIn ? (
          <Button
            variant="outline"
            disabled
            title="Wishlists open in a later release"
            className="cursor-not-allowed"
          >
            {book.userState.wishlisted ? (
              <BookmarkCheck className="size-4" aria-hidden="true" />
            ) : (
              <Bookmark className="size-4" aria-hidden="true" />
            )}
            {book.userState.wishlisted ? "On your wishlist" : "Add to wishlist"}
          </Button>
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

      {book.effectiveAvailable === 0 && book.queueLength > 0 ? (
        <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Users className="size-3.5" aria-hidden="true" />
          {book.queueLength} {book.queueLength === 1 ? "reader is" : "readers are"} waiting for this
          book.
        </p>
      ) : null}
    </div>
  );
}

