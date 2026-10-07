"use client";

import * as React from "react";
import useSWR from "swr";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { loansApi, membersApi, settingsApi } from "@/lib/api-client";
import { MemberSearchCombobox } from "@/components/features/circulation/member-search-combobox";
import { BookSearchCombobox } from "@/components/features/circulation/book-search-combobox";
import { IssueTicket } from "@/components/features/circulation/issue-ticket";
import { LoansTable, NoLoans } from "@/components/features/circulation/loans-table";
import { DESK_TABS, useLoanFilters, useLoansKey } from "@/hooks/use-loan-filters";
import type { BookSummary, MemberSummary } from "@/lib/api-client";

/**
 * The librarian's circulation desk (spec 12).
 *
 * **The shape follows the librarian's hands.** Issue a book and return a book are the two
 * things that happen at this desk, thousands of times, so both are above the fold and one
 * click apart from their data. Everything else — the loan history — sits below.
 *
 * Three fetches, all independent:
 * - the **policy**, so the ticket can preview a due date and the Renew button can explain
 *   itself. Public endpoint, 7 fields, no session needed.
 * - the **loan list**, keyed on the URL filters so a filtered desk is shareable.
 * - a **one-shot lookup of a deep-linked member/book**, only when the URL names one.
 *
 * **The SWR fetcher takes no positional parameters.** SWR calls `fetcher(key)`, so a
 * `(signal?: AbortSignal)` parameter receives the *string cache key* and hands it to
 * `fetch`, which throws `Failed to convert value to 'AbortSignal'`. That bug cost the
 * Unit 08 table and the Unit 09 catalog a full unit each, and neither an HTTP status check
 * nor a build can see it — the page returns 200 with a correct-looking shell and nothing
 * in it.
 */
export function CirculationDesk({ initialMemberId }: { initialMemberId?: string }) {
  const filters = useLoanFilters();

  const [member, setMember] = React.useState<MemberSummary | null>(null);
  const [book, setBook] = React.useState<BookSummary | null>(null);

  /* ------------------------------ Policy -------------------------------- */
  const { data: policy } = useSWR("/api/settings/public", () => settingsApi.public());

  /* ------------------------------ Loans --------------------------------- */
  const key = useLoansKey({
    q: filters.q,
    status: filters.status,
    memberId: filters.memberId || undefined,
    bookId: filters.bookId || undefined,
    limit: 20,
  });

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    // The fetcher takes **no parameters**: SWR calls `fetcher(key)`, so a
    // `(signal?: AbortSignal)` parameter would receive the string cache key and hand it
    // straight to `fetch`, which throws. The controller is created here and simply left
    // to be garbage collected when the request settles.
    const controller = new AbortController();
    return loansApi.list(
      {
        q: filters.q || undefined,
        status: filters.status,
        memberId: filters.memberId || undefined,
        bookId: filters.bookId || undefined,
        limit: 20,
      },
      controller.signal,
    );
  });

  const loans = data?.data.items ?? [];
  const total = data?.meta?.total ?? 0;

  /*
   * Preselect from the URL — the "Issue a book" action on a member's record.
   *
   * **Fetches the record by id; it does not search for it.** The link carries
   * `?memberId=<Mongo ObjectId>`, while `membersApi.lookup` searches *name, email and
   * membership ID*. Handing it an ObjectId returns an empty list, so the desk silently
   * arrived with nobody selected — a deep link that looked like it worked and did not.
   *
   * Only fetched when `initialMemberId` is present, so an ordinary desk visit makes no
   * request nobody asked for.
   */
  React.useEffect(() => {
    if (!initialMemberId || member) return;

    let cancelled = false;

    void (async () => {
      try {
        const found = await membersApi.get(initialMemberId);
        if (cancelled) return;

        // `MemberRecord` carries `activeLoans`, which is what the ticket's loan-limit
        // check reads, so no second request is needed.
        setMember(found);
        filters.set({ memberId: found.id });
      } catch {
        // A stale id in the URL must not break the desk; the member simply stays unset.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally runs once per `initialMemberId`; `filters` is a new object each
    // render and depending on it would refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMemberId, member]);

  /* ---------------------------- Issue a book ----------------------------- */
  const onIssued = React.useCallback(() => {
    setBook(null);
    void mutate();
    // `use-loans-filters.ts` also clears `bookId` so the filtered list is not left
    // showing only the book that was just issued.
    filters.set({ bookId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutate]);

  const clearBook = React.useCallback(() => {
    setBook(null);
    filters.set({ bookId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearMember = React.useCallback(() => {
    setMember(null);
    filters.set({ memberId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container-page space-y-8">
      <PageHeader
        title="Circulation desk"
        description="Issue a book to a member, take returns, and renew loans that are still eligible."
      />

      {/* ---------------------------- Issue a book ---------------------------- */}
      <section aria-labelledby="issue-heading" className="space-y-5">
        <h2
          id="issue-heading"
          className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
        >
          Issue a book
        </h2>

        {/* Two cards side by side on desktop, stacked on mobile — the desk is a
            two-pane task and on a phone the panes become steps.

            **`min-w-0` on both is load-bearing.** A grid item defaults to
            `min-width: auto`, which means it refuses to shrink below its content. The
            selected-member and selected-book cards are wide (avatar + truncated name +
            status badge), so the implicit track sized to max-content and pushed the page
            36px past a 390px viewport — a horizontal scroll on the most-used staff screen.
            `min-w-0` lets the track shrink and the `truncate` children do their job. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-soft">
            <MemberSearchCombobox value={member} onChange={setMember} autoFocus />
          </div>

          <div className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-soft">
            <BookSearchCombobox value={book} onChange={setBook} />
          </div>
        </div>

        {member && book ? (
          <IssueTicket
            member={member}
            book={book}
            policy={policy}
            onIssued={onIssued}
            onClearBook={clearBook}
          />
        ) : (
          // The two selectors are the only way in, so say which one is missing rather
          // than leaving a librarian staring at an empty panel.
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-5 py-6 text-center text-small text-muted-foreground">
            {!member && !book
              ? "Search for a member and a book to see the issue ticket."
              : !member
                ? "Now search for the member borrowing this book."
                : "Now search for the book to issue."}
          </p>
        )}

        {/* A live selection summary, so the desk always shows who and what even while the
            ticket is hidden by a cleared book selector. */}
        {member || book ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-muted-foreground">Selecting:</span>
            {member ? (
              <Badge variant="soft" className="gap-1.5">
                {member.name}
                <button
                  type="button"
                  onClick={clearMember}
                  aria-label="Clear the selected member"
                  className="rounded-full p-0.5 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
                >
                  <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </Badge>
            ) : null}
            {book ? (
              <Badge variant="soft" className="gap-1.5">
                <span className="max-w-48 truncate">{book.title}</span>
                <button
                  type="button"
                  onClick={clearBook}
                  aria-label="Clear the selected book"
                  className="rounded-full p-0.5 transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
                >
                  <X className="size-3" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </Badge>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* ------------------------------ Loan list ----------------------------- */}
      <section aria-labelledby="loans-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="loans-heading"
            className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
          >
            Loans
          </h2>

          <p aria-live="polite" className="text-small text-muted-foreground">
            {isLoading && !data ? "Loading…" : `${total} ${total === 1 ? "loan" : "loans"}`}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              value={filters.draft}
              onChange={(event) => filters.setDraft(event.target.value)}
              onFocus={() => filters.setEditing(true)}
              onBlur={() => filters.setEditing(false)}
              placeholder="Search a member or book title…"
              aria-label="Search loans"
              className="pl-10"
            />
            {filters.draft ? (
              <button
                type="button"
                onClick={() => filters.setDraft("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={filters.status}
              onValueChange={(value) => filters.set({ status: value })}
            >
              <TabsList>
                {DESK_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {filters.q ? (
              <>
                <Badge variant="soft" className="gap-1.5">
                  1 filter active
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={filters.reset}
                  className="text-muted-foreground"
                >
                  Reset
                </Button>
              </>
            ) : null}
          </div>
        </div>

        {error && !data ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-small text-danger-ink">
              {error instanceof Error ? error.message : "Something went wrong."}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => void mutate()}>
              Try again
            </Button>
          </div>
        ) : (
          <LoansTable
            loans={loans}
            isLoading={isLoading}
            policy={policy}
            onChanged={() => void mutate()}
            emptyState={
              <div className="rounded-lg border border-border bg-surface">
                <NoLoans status={filters.q ? "active" : filters.status} />
              </div>
            }
          />
        )}
      </section>
    </div>
  );
}