import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { BookCover } from "@/components/common/book-cover";
import { CountdownRing } from "@/components/features/circulation/loan-state-chip";
import { EmptyState } from "@/components/common/empty-state";
import type { MemberDashboard } from "@/types";

type Reading = MemberDashboard["reading"][number];

/**
 * "Currently reading" — a horizontal scroller of the books out on loan.
 *
 * **A horizontal scroller, not a grid, because this row is the screen's reason for existing.**
 * A member with four books out wants to see all four without scrolling past three recommendation
 * rows; a 2×2 grid would push the fourth below the fold on a laptop.
 *
 * **`CountdownRing` is the existing component, not a second one.** It already encodes the
 * urgency-to-colour rule (`daysLeft < 0` → danger-ink, `<= 3` → warning-ink, else success-ink)
 * against the same `daysLeft` the loan rows use, so a dashboard ring and a loan-row badge cannot
 * disagree about the same book (invariant 12, and the Unit 11 single-definition rule).
 *
 * **`loanPeriod` is a prop, not a settings fetch.** The ring's arc needs the *maximum* to scale
 * against, and that number is policy — read from `getSettings()` on the server and passed in,
 * exactly as `MyLoans` does. A ring that divided by a locally-guessed 14 would be wrong the day
 * an admin changed the loan period.
 */
export function ReadingScroller({
  loans,
  loanPeriod,
}: {
  loans: MemberDashboard["reading"];
  loanPeriod: number;
}) {
  return (
    <section aria-labelledby="currently-reading" className="space-y-4">
      {/* Wraps for the same reason as the recommendation shelf: a heading and a link are
          siblings that cannot both fit on one line at 360px. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="currently-reading" className="font-display text-h2 font-semibold tracking-[-0.02em]">
          Currently reading
        </h2>
        {loans.length > 0 ? (
          <Link
            href="/my-loans"
            className="text-small font-medium text-primary underline-offset-4 hover:underline"
          >
            All {loans.length} books
          </Link>
        ) : null}
      </div>

      {loans.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={BookOpen}
            title="Nothing out at the moment"
            description="Borrow something from the catalog and it will appear here with a countdown to its due date."
            action={
              <Link
                href="/catalog"
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-small font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Browse the catalog
              </Link>
            }
          />
        </Card>
      ) : (
        /* `role="list"` on the track and on each card, because a scroller of links with no list
           semantics is announced as an unlabelled pile of anchors. The `aria-label` on the track
           is what a screen-reader user hears instead of eight filenames in a row. */
        <ul
          role="list"
          aria-label="Books currently on loan"
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
        >
          {loans.map((loan) => (
            <li key={loan.id} className="w-[15rem] shrink-0 snap-start sm:w-[17rem]">
              <ReadingCard loan={loan} loanPeriod={loanPeriod} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReadingCard({ loan, loanPeriod }: { loan: Reading; loanPeriod: number }) {
  // `slug` is empty for a book document that has since been deleted — a real state, because a
  // loan outlives its book. Rendering `href="/catalog/"` there would land the member on the
  // catalog listing after clicking a specific book, which is the Unit 14 bug exactly.
  const hasPage = loan.book.slug.length > 0;

  /*
   * **No `sr-only` span inside the link.** The title is already the link's text, so the
   * accessible name is the book title and needs nothing added. The span that used to be here
   * read "Open in the catalog" — and being `position: absolute` with no positioned ancestor, it
   * was laid out relative to the **initial containing block**, escaping the scroller's clip and
   * pushing the whole document 197px wider than a 360px screen. A horizontal page scrollbar on
   * the member's own dashboard, caused by a screen-reader-only caption. Same class of bug in
   * `RecommendedRow`; both removed.
   */
  const body = (
    <>
      <BookCover
        publicId={loan.book.cover?.publicId ?? null}
        url={loan.book.cover?.url ?? null}
        title={loan.book.title}
        author={loan.book.authors[0] ?? null}
        width={160}
        sizes="(max-width: 640px) 15rem, 17rem"
        className="h-[13rem] w-full"
      />
      <div className="space-y-1">
        <p className="line-clamp-2 text-small font-medium text-foreground">{loan.book.title}</p>
        <p className="text-caption text-muted-foreground">{formatDate(loan.dueDate)}</p>
      </div>
    </>
  );

  return (
    <Card
      className={cn(
        "h-full gap-3 p-3",
        // The card is the pointer target only when there is somewhere to go.
        hasPage && "transition-shadow hover:shadow-lift",
      )}
    >
      <div className="flex items-start gap-3">
        {hasPage ? (
          <Link href={`/catalog/${loan.book.slug}`} className="min-w-0 flex-1 space-y-3">
            {body}
          </Link>
        ) : (
          <div className="min-w-0 flex-1 space-y-3">
            {body}
            <p className="text-caption text-muted-foreground">
              This title is no longer in the catalog.
            </p>
          </div>
        )}

        <CountdownRing daysLeft={loan.daysLeft} loanPeriod={loanPeriod} size={72} />
      </div>

      {/* Only meaningful when somebody else is queuing for this exact book — which is precisely
          when renewing becomes impossible, so the member needs it in advance, not at the point
          of refusal. */}
      {loan.queuePosition !== null ? (
        <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Clock className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {loan.queuePosition === 1
            ? "Someone is waiting — this is your last renewal"
            : `${loan.queuePosition} people waiting`}
        </p>
      ) : null}
    </Card>
  );
}