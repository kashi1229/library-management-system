"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCcw, Undo2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookCover } from "@/components/common/book-cover";
import { EmptyState } from "@/components/common/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoanStateChip } from "@/components/features/circulation/loan-state-chip";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { loansApi, toErrorMessage, type LoanSummary, type PublicPolicy } from "@/lib/api-client";
import { formatCurrency, formatDate, initials } from "@/lib/utils";

/**
 * The desk's loan table (spec 12).
 *
 * **One component, two layouts.** A real `<table>` from `md` up and stacked cards below,
 * rendered from the same array — the same decision as `MembersTable` and the books table.
 * Writing the rows twice is how the mobile version drifts and how a column quietly goes
 * missing on phones.
 *
 * **Return and Renew are one-click in the row**, because a returns pile is a queue of
 * physical books and the librarian's hands are busy. Return still goes through
 * `ConfirmDialog` — it is irreversible and can create a fine — but Renew does not: it is
 * reversible (they can renew again) and it is the member's own routine action.
 *
 * Renew's disabled state **says why**. A greyed-out button with no explanation is the
 * single most common complaint at a circulation desk, and the reasons are already known
 * client-side: returned, overdue, renewals exhausted.
 */
export function LoansTable({
  loans,
  isLoading,
  policy,
  onChanged,
  emptyState,
}: {
  loans: LoanSummary[];
  isLoading?: boolean;
  policy: PublicPolicy | undefined;
  onChanged: () => void;
  emptyState?: React.ReactNode;
}) {
  const [returning, setReturning] = React.useState<LoanSummary | null>(null);
  const [renewingId, setRenewingId] = React.useState<string | null>(null);

  const doReturn = async () => {
    if (!returning) return;

    try {
      const result = await loansApi.return(returning.id);
      // The fine is `null` until Unit 13 fills the hook in, so the copy has to work
      // either way rather than promising a fine that will not exist.
      toast.success(
        `“${result.loan.book.title}” returned`,
        {
          description: result.fine
            ? `A fine of ${formatCurrency(result.fine.amount)} was raised for ${result.fine.daysOverdue} days late.`
            : `Returned on time. ${returning.member.name} can borrow again.`,
        },
      );
      setReturning(null);
      onChanged();
    } catch (error) {
      toast.error("Could not return that book", {
        description: toErrorMessage(error, "Please try again."),
      });
    }
  };

  const doRenew = async (loan: LoanSummary) => {
    setRenewingId(loan.id);

    try {
      await loansApi.renew(loan.id);
      toast.success(`“${loan.book.title}” renewed`, {
        description: `Now due ${formatDate(new Date(loan.dueDate), "d MMM yyyy")} plus the extension.`,
      });
      onChanged();
    } catch (error) {
      // The server owns the rules, so its sentence is the explanation. Showing our own
      // would be a second implementation that can disagree.
      toast.error("Could not renew that loan", {
        description: toErrorMessage(error, "Please try again."),
      });
    } finally {
      setRenewingId(null);
    }
  };

  if (isLoading && loans.length === 0) return <LoansSkeleton />;
  if (loans.length === 0) return <>{emptyState}</>;

  return (
    <>
      {/* ------------------------------ Desktop ------------------------------ */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" aria-hidden="true">
                <span className="sr-only">Cover</span>
              </TableHead>
              <TableHead className="min-w-[14rem]">Book</TableHead>
              <TableHead className="min-w-[12rem]">Member</TableHead>
              <TableHead className="w-32">Issued</TableHead>
              <TableHead className="w-32">Due</TableHead>
              <TableHead className="min-w-[11rem]">Status</TableHead>
              <TableHead className="w-36 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loans.map((loan) => {
              const refusal = renewRefusal(loan, policy);

              return (
                <TableRow key={loan.id}>
                  <TableCell>
                    <BookCover
                      publicId={loan.book.cover?.publicId}
                      url={loan.book.cover?.url}
                      title={loan.book.title}
                      author={loan.book.authors[0] ?? null}
                      width={32}
                      sizes="32px"
                      className="h-11 w-7 shrink-0 rounded-sm"
                    />
                  </TableCell>

                  <TableCell className="whitespace-normal">
                    <Link
                      href={`/catalog/${loan.book.slug}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
                    >
                      {loan.book.title}
                    </Link>
                    {loan.renewCount > 0 ? (
                      <Badge variant="outline" className="ms-2 font-mono">
                        {loan.renewCount}&times;
                      </Badge>
                    ) : null}
                  </TableCell>

                  <TableCell>
                    <Link
                      href={`/staff/members/${loan.member.id}`}
                      className="text-small text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
                    >
                      {loan.member.name}
                    </Link>
                    {loan.member.membershipId ? (
                      <p className="font-mono text-caption text-muted-foreground">
                        {loan.member.membershipId}
                      </p>
                    ) : null}
                  </TableCell>

                  <TableCell>
                    <span className="whitespace-nowrap text-small text-muted-foreground">
                      {formatDate(loan.issuedAt)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="whitespace-nowrap text-small text-muted-foreground">
                      {formatDate(loan.dueDate)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <LoanStateChip loan={loan} />
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {loan.status === "active" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={Boolean(refusal) || renewingId === loan.id}
                            title={refusal ?? undefined}
                            onClick={() => void doRenew(loan)}
                          >
                            <RotateCcw
                              className={cn(
                                "size-3.5",
                                renewingId === loan.id && "animate-spin",
                              )}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            Renew
                          </Button>

                          <Button size="sm" variant="default" onClick={() => setReturning(loan)}>
                            <Undo2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                            Return
                          </Button>
                        </>
                      ) : (
                        <span className="text-caption text-muted-foreground">
                          {loan.returnedAt ? `Back ${formatDate(loan.returnedAt)}` : "Closed"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------- Mobile ------------------------------- */}
      <ul className="space-y-3 md:hidden">
        {loans.map((loan) => {
          const refusal = renewRefusal(loan, policy);

          return (
            <li key={loan.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex gap-3">
                <BookCover
                  publicId={loan.book.cover?.publicId}
                  url={loan.book.cover?.url}
                  title={loan.book.title}
                  author={loan.book.authors[0] ?? null}
                  width={40}
                  sizes="40px"
                  className="h-14 w-9 shrink-0 rounded-sm"
                />

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/catalog/${loan.book.slug}`}
                    className="line-clamp-2 font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {loan.book.title}
                  </Link>

                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="size-5 shrink-0">
                      {loan.member.avatar ? (
                        <AvatarImage src={loan.member.avatar.url} alt="" />
                      ) : (
                        <AvatarFallback className="text-[9px]">
                          {initials(loan.member.name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <Link
                      href={`/staff/members/${loan.member.id}`}
                      className="truncate text-caption text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {loan.member.name}
                    </Link>
                  </div>

                  <div className="mt-2">
                    <LoanStateChip loan={loan} />
                  </div>
                </div>
              </div>

              {loan.status === "active" ? (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={Boolean(refusal) || renewingId === loan.id}
                    title={refusal ?? undefined}
                    onClick={() => void doRenew(loan)}
                  >
                    <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    Renew
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => setReturning(loan)}
                  >
                    <Undo2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    Return
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(next) => {
          if (!next) setReturning(null);
        }}
        title={`Return “${returning?.book.title ?? "this book"}”?`}
        consequence={
          returning && returning.daysOverdue > 0
            ? `This loan is ${returning.daysOverdue} ${returning.daysOverdue === 1 ? "day" : "days"} overdue, so a fine of about ${formatCurrency(returning.daysOverdue * (policy?.finePerDay ?? 0))} will be raised for ${returning.member.name}.`
            : `The copy goes back on the shelf and ${returning?.member.name ?? "the member"} can borrow again. Any waiting member is offered the copy.`
        }
        confirmLabel="Return book"
        onConfirm={doReturn}
      />
    </>
  );
}

/**
 * Why this loan cannot be renewed, or `null` when it can.
 *
 * **A preview, like the issue checklist.** The server re-checks all four inside the
 * transaction, and its message wins. This exists so the button is not mysteriously dead
 * and so the common cases do not cost a round trip.
 */
function renewRefusal(loan: LoanSummary, policy: PublicPolicy | undefined): string | null {
  if (loan.status !== "active") return "This loan has already been returned.";
  if (loan.view === "overdue" || loan.daysLeft < 0) {
    return "An overdue loan cannot be renewed. Take the return first.";
  }
  if (policy && loan.renewCount >= policy.maxRenewals) {
    return `Already renewed ${loan.renewCount} ${loan.renewCount === 1 ? "time" : "times"}. The limit is ${policy.maxRenewals}.`;
  }
  return null;
}

/** Skeletons mirroring the row shape, so nothing jumps when data lands. */
function LoansSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading loans">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
        >
          <Skeleton className="h-11 w-7 shrink-0 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="hidden h-3 w-24 sm:block" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Shared empty state so the desk and the empty table read the same. */
export function NoLoans({ status }: { status: string }) {
  const copy: Record<string, { title: string; description: string }> = {
    overdue: {
      title: "Nothing overdue",
      description: "Every book that is out is still within its due date. That is a good day.",
    },
    due_soon: {
      title: "Nothing due soon",
      description: "No book is due in the next few days. Loans that are already overdue are under Overdue.",
    },
    returned: {
      title: "No returned loans yet",
      description: "Books appear here once they come back to the desk.",
    },
    active: {
      title: "No loans match",
      description: "Nothing is out under the current filters. Issue a book above to get started.",
    },
  };

  const entry = copy[status] ?? copy.active;

  return (
    <EmptyState icon={Users} title={entry.title} description={entry.description} />
  );
}