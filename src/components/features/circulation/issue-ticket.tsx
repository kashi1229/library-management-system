"use client";

import * as React from "react";
import { addDays, format } from "date-fns";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BookCover } from "@/components/common/book-cover";
import { loansApi, toErrorMessage, type BookSummary, type MemberSummary, type PublicPolicy } from "@/lib/api-client";

/**
 * The issue ticket and its policy checklist (spec 12).
 *
 * A librarian's real question before handing over a book is "can I?" — and the answer has
 * four parts, each of which the server will refuse on if it is not true. Showing all four
 * up front turns a refusal into a confirmation.
 *
 * **This checklist is a preview, never the authority.** Every check below is computed in
 * the browser from data already fetched for the two selectors, and every one of them can
 * be wrong: another librarian can take the last copy between the search and the click, a
 * fine can be paid, a member can be suspended. So `Issue book` stays enabled whenever the
 * *client* is confident, and the server's refusal is shown verbatim in a toast when it
 * disagrees. Encoding the rules here as the gate would mean two implementations of every
 * policy, and the browser one would silently win whenever it drifted.
 *
 * The one thing the checklist does own is **honesty about what it does not know**. The
 * unpaid-fine check is `unknown` rather than pass or fail, because the member search does
 * not return a fine total — inventing a green tick there would be a lie with a checkmark
 * on it.
 */
export function IssueTicket({
  member,
  book,
  policy,
  onIssued,
  onClearBook,
}: {
  member: MemberSummary;
  book: BookSummary;
  policy: PublicPolicy | undefined;
  onIssued: () => void;
  onClearBook: () => void;
}) {
  const [issuing, setIssuing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dueDate = addDays(new Date(), policy?.loanPeriodDays ?? 14);

  const checks = React.useMemo(
    () => buildChecks(member, book, policy),
    [member, book, policy],
  );

  const blocking = checks.filter((check) => check.state === "fail");
  const canIssue = blocking.length === 0 && !issuing;

  const issue = async () => {
    setIssuing(true);
    setError(null);

    try {
      await loansApi.issue({ memberId: member.id, bookId: book._id });
      // `onIssued` revalidates the loan list and clears the book selector.
      onIssued();
    } catch (caught) {
      const message = toErrorMessage(caught, "We could not issue that book.");
      setError(message);
      // Also a toast, because the server's sentence is the best explanation available and
      // the inline banner sits under a list the librarian may not be looking at.
      toast.error("Could not issue that book", { description: message });
    } finally {
      setIssuing(false);
    }
  };

  return (
    <section
      aria-labelledby="issue-ticket-heading"
      className="rounded-lg border border-border bg-surface p-5 shadow-soft md:p-6"
    >
      <h2
        id="issue-ticket-heading"
        className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
      >
        Ready to issue
      </h2>
      <p className="mt-1 text-small text-muted-foreground">
        Check the policy before handing the book over.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
        {/* ------------------------------ Member ------------------------------ */}
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-14 shrink-0">
            {member.avatar ? (
              <AvatarImage src={member.avatar.url} alt="" />
            ) : (
              <AvatarFallback className="bg-primary-soft text-h3 text-primary">
                {member.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="min-w-0">
            <p className="truncate text-body font-medium text-foreground">{member.name}</p>
            <p className="truncate text-caption text-muted-foreground">
              {member.membershipId ?? member.email}
            </p>
            {member.department ? (
              <p className="truncate text-caption text-muted-foreground">{member.department}</p>
            ) : null}
          </div>
        </div>

        <span
          aria-hidden="true"
          className="hidden h-10 w-px bg-border md:block"
        />

        {/* ------------------------------- Book ------------------------------- */}
        <div className="flex min-w-0 items-center gap-3">
          <BookCover
            publicId={book.cover?.publicId}
            url={book.cover?.url}
            title={book.title}
            author={book.authors[0] ?? null}
            categoryColor={book.category.color}
            width={56}
            sizes="56px"
            className="h-[84px] w-14 shrink-0 rounded-md"
          />

          <div className="min-w-0">
            <p className="line-clamp-2 text-body font-medium text-foreground">{book.title}</p>
            <p className="mt-0.5 truncate text-caption text-muted-foreground">
              {book.authors.join(", ") || book.category.name}
            </p>
            <p className="mt-1 text-caption text-muted-foreground">
              Due <span className="font-medium text-foreground">{format(dueDate, "d MMM yyyy")}</span>
              {policy ? (
                <span className="text-muted-foreground/80">
                  {" "}
                  &middot; {policy.loanPeriodDays}-day loan
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {/* ----------------------------- Checklist ----------------------------- */}
      <ul className="mt-6 space-y-2 border-t border-border pt-5">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2.5 text-small">
            <CheckGlyph state={check.state} />
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "font-medium",
                  check.state === "fail"
                    ? "text-danger-ink"
                    : check.state === "pass"
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {check.label}
              </span>
              {check.detail ? (
                <span className="text-muted-foreground"> — {check.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {error ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger-ink"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}

      {/* ------------------------------- Actions ------------------------------ */}
      <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
        <Button type="button" variant="outline" onClick={onClearBook} disabled={issuing}>
          Change book
        </Button>

        <Button
          type="button"
          onClick={issue}
          disabled={!canIssue}
          // The button states *why* it is disabled rather than just being grey, because a
          // dead button with no reason is the single most common complaint at a desk.
          title={
            blocking.length > 0
              ? blocking.map((check) => check.label).join(" · ")
              : undefined
          }
          className="sm:min-w-44"
        >
          {issuing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Issuing…
            </>
          ) : (
            "Issue book"
          )}
        </Button>
      </div>
    </section>
  );
}

/** The three states a check can be in. `unknown` is the honest default. */
type CheckState = "pass" | "fail" | "unknown";

type PolicyCheck = {
  id: string;
  label: string;
  state: CheckState;
  /** The sentence a librarian reads when it fails. */
  detail?: string;
};

function buildChecks(
  member: MemberSummary,
  book: BookSummary,
  policy: PublicPolicy | undefined,
): PolicyCheck[] {
  const checks: PolicyCheck[] = [];

  checks.push(
    member.status === "active"
      ? { id: "active", label: "Member account is active", state: "pass" }
      : {
          id: "active",
          label: "Member account is active",
          state: "fail",
          detail: "Reinstate the account before issuing books.",
        },
  );

  checks.push(
    book.status === "active"
      ? { id: "book-active", label: "Book is in the catalog", state: "pass" }
      : {
          id: "book-active",
          label: "Book is in the catalog",
          state: "fail",
          detail: "Archived books cannot be issued.",
        },
  );

  checks.push(
    book.availableCopies > 0
      ? {
          id: "copies",
          label: "A copy is available",
          state: "pass",
          detail: `${book.availableCopies} of ${book.totalCopies} free.`,
        }
      : {
          id: "copies",
          label: "A copy is available",
          state: "fail",
          detail: "Every copy is on loan or held for another member.",
        },
  );

  const limit = policy?.maxActiveLoans;
  checks.push(
    limit === undefined
      ? { id: "limit", label: `Within the ${limit ?? "?"}-book loan limit`, state: "unknown" }
      : member.activeLoans < limit
        ? {
            id: "limit",
            label: `Within the ${limit}-book loan limit`,
            state: "pass",
            detail: `${member.activeLoans} of ${limit} out.`,
          }
        : {
            id: "limit",
            label: `Within the ${limit}-book loan limit`,
            state: "fail",
            detail: `Already at the limit with ${member.activeLoans} out.`,
          },
  );

  /*
   * `unknown`, deliberately. The member lookup returns an active-loan count but **no fine
   * total**, so this cannot be checked client-side without another request per keystroke.
   * A green tick here would be asserting something nothing has verified — and the one
   * check a member would be most upset to get wrong is the one about owing money.
   */
  checks.push({
    id: "fines",
    label: "No unpaid fines over the block limit",
    state: "unknown",
    detail: "Confirmed when the book is issued.",
  });

  return checks;
}

/**
 * A check's glyph.
 *
 * Three shapes — tick, cross, dash — so the state is legible **without colour**, which is
 * WCAG SC 1.4.1. The `-ink` tokens keep the text and the glyph on their tint at AA.
 */
function CheckGlyph({ state }: { state: CheckState }) {
  if (state === "pass") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft text-success-ink"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }

  if (state === "fail") {
    return (
      <span
        aria-hidden="true"
        className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-danger-soft text-danger-ink"
      >
        <X className="size-3" strokeWidth={3} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
    >
      <span className="size-1.5 rounded-full bg-current" />
    </span>
  );
}