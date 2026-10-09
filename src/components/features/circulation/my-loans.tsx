"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCover } from "@/components/common/book-cover";
import { CountdownRing } from "@/components/features/circulation/loan-state-chip";
import { loansApi, toErrorMessage, type LoanSummary, type PublicPolicy } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * A member's active loan, with a countdown (spec 12).
 *
 * The ring is the centrepiece because **days remaining is the only thing a member is
 * actually asking**. "Due 14 Oct" is a date to be converted into anxiety; "3 days left" is
 * the answer.
 *
 * **Renew's disabled state explains itself.** The three reasons are known without a round
 * trip (returned, overdue, renewals used up), and a greyed-out button with no explanation
 * is the most common complaint a lending app receives. The reason is both a `title` and an
 * `sr-only` line, because a `title` alone is unreachable by touch and keyboard.
 *
 * The renewal is **optimistic**: the row updates to the extended date immediately and rolls
 * back on failure. Renewing is the member's most frequent action here and waiting on a
 * round trip for a due date feels broken.
 */
export function MyLoanCard({
  loan,
  policy,
  onRenewed,
}: {
  loan: LoanSummary;
  policy: PublicPolicy | undefined;
  onRenewed: () => void;
}) {
  const [renewing, setRenewing] = React.useState(false);
  const [optimisticDue, setOptimisticDue] = React.useState<string | null>(null);
  const [optimisticCount, setOptimisticCount] = React.useState<number | null>(null);

  // While an optimistic value is showing, it *is* the loan. `renewCount` moves with the
  // date so the button disables itself at the limit without waiting for the refetch.
  const shownDue = optimisticDue ?? loan.dueDate;
  const shownCount = optimisticCount ?? loan.renewCount;

  const overdue = loan.view === "overdue";
  const atLimit = policy ? shownCount >= policy.maxRenewals : false;

  const refusal = !policy
    ? null
    : overdue
      ? "This book is overdue, so it cannot be renewed. Please return it and settle any fine."
      : atLimit
        ? `You have used all ${policy.maxRenewals} renewals for this loan.`
        : null;

  const renew = async () => {
    setRenewing(true);

    // Optimistic: extend by the policy now, and let the server's response correct it.
    const preview = new Date(
      new Date(loan.dueDate).getTime() + (policy?.renewalExtensionDays ?? 7) * 86_400_000,
    ).toISOString();
    setOptimisticDue(preview);
    setOptimisticCount(shownCount + 1);

    try {
      const updated = await loansApi.renew(loan.id);
      setOptimisticDue(updated.dueDate);
      setOptimisticCount(updated.renewCount);
      toast.success("Loan renewed", {
        description: `“${loan.book.title}” is now due ${formatDate(updated.dueDate)}.`,
      });
      onRenewed();
    } catch (error) {
      // Roll back to the server's truth rather than leaving a date that never existed.
      setOptimisticDue(null);
      setOptimisticCount(null);
      toast.error("Could not renew that loan", {
        description: toErrorMessage(error, "Please try again."),
      });
    } finally {
      setRenewing(false);
    }
  };

  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-lg border bg-surface shadow-soft",
        overdue ? "border-danger/40" : "border-border",
      )}
    >
      {/* The overdue ribbon (spec 12). A left edge, not a corner fold — a diagonal
          ribbon clips the rounded corner and reads as damage rather than as a state. */}
      {overdue ? (
        <span
          className="absolute inset-y-0 start-0 w-1 bg-danger"
          aria-hidden="true"
        />
      ) : null}

      <div className="flex flex-col gap-4 p-4 ps-5 sm:flex-row sm:items-center sm:p-5 sm:ps-6">
        <BookCover
          publicId={loan.book.cover?.publicId}
          url={loan.book.cover?.url}
          title={loan.book.title}
          author={loan.book.authors[0] ?? null}
          width={56}
          sizes="56px"
          className="h-[84px] w-14 shrink-0 rounded-md"
        />

        <div className="min-w-0 flex-1">
          <Link
            href={`/catalog/${loan.book.slug}`}
            className="line-clamp-2 font-display text-h3 font-semibold tracking-[-0.02em] text-foreground underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
          >
            {loan.book.title}
          </Link>

          <p className="mt-0.5 truncate text-small text-muted-foreground">
            {loan.book.authors.join(", ") || "Unknown author"}
          </p>

          <p className="mt-1.5 text-small text-muted-foreground">
            Due <span className="font-medium text-foreground">{formatDate(shownDue)}</span>
            {shownCount > 0 ? (
              <Badge variant="outline" className="ms-2 font-mono">
                {shownCount}&times; renewed
              </Badge>
            ) : null}
          </p>

          {overdue ? (
            <p className="mt-1 text-small font-medium text-danger-ink">
              {loan.daysOverdue} {loan.daysOverdue === 1 ? "day" : "days"} overdue. Please
              return it to stop the fine growing.
            </p>
          ) : null}

          {/* The reason travels with the button, not only in `title`, so it is reachable
              without a pointer. */}
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(refusal) || renewing}
              title={refusal ?? undefined}
              onClick={() => void renew()}
              aria-describedby={refusal ? `renew-reason-${loan.id}` : undefined}
            >
              <Clock className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {renewing ? "Renewing…" : "Renew"}
            </Button>
            {refusal ? (
              <p
                id={`renew-reason-${loan.id}`}
                className="mt-1.5 text-caption text-muted-foreground"
              >
                {refusal}
              </p>
            ) : null}
          </div>
        </div>

        {policy ? (
          <CountdownRing
            daysLeft={loan.daysLeft}
            loanPeriod={policy.loanPeriodDays}
            className="self-center"
          />
        ) : null}
      </div>
    </li>
  );
}

/** A returned loan: one compact line, no ring, no actions (spec 12). */
export function MyLoanHistoryRow({ loan }: { loan: LoanSummary }) {
  return (
    <li className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <BookCover
        publicId={loan.book.cover?.publicId}
        url={loan.book.cover?.url}
        title={loan.book.title}
        author={loan.book.authors[0] ?? null}
        width={32}
        sizes="32px"
        className="h-11 w-7 shrink-0 rounded-sm"
      />

      <div className="min-w-0 flex-1">
        <Link
          href={`/catalog/${loan.book.slug}`}
          className="line-clamp-1 text-small font-medium text-foreground underline-offset-2 hover:underline"
        >
          {loan.book.title}
        </Link>
        <p className="text-caption text-muted-foreground">
          Borrowed {formatDate(loan.issuedAt)} &middot; returned{" "}
          {loan.returnedAt ? formatDate(loan.returnedAt) : "—"}
          {loan.fineAmount > 0 ? (
            <span className="ms-2 font-medium text-danger-ink">
              {formatCurrency(loan.fineAmount)} fine
            </span>
          ) : null}
        </p>
      </div>

      {/*
          * "Write a review" is **live** (Unit 15). It is a link to the book page's review
          * section rather than a control on this page: reviewing is the one member action
          * that needs the book's context beside it — the rating summary, the reviews it would
          * join, and the borrow history that makes them eligible. A dialog here would put
          * a star picker in a window with none of that, and would need its own copy of the
          * eligibility rule.
          *
          * Returned books only, and only for a book that still has a slug to navigate to —
          * a deleted book would take the member to a 404 from a button labelled "review".
          */}
      {loan.book.slug ? (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/catalog/${loan.book.slug}#reviews`}>
            <Star className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Write a review
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

/** Loading placeholders that match the card's real footprint. */
export function MyLoansSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading your loans">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5"
        >
          <Skeleton className="h-[84px] w-14 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="size-[84px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}