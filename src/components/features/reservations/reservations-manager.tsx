"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  BookTitle,
  ReservationCard,
  ReservationRowActionMenu,
  ReservationStatusLine,
  closedLabel,
} from "@/components/features/reservations/reservation-row-actions";
import { reservationsApi, toErrorMessage, type ReservationSummary } from "@/lib/api-client";
import { formatDate, initials } from "@/lib/utils";
import type { ReservationStatus } from "@/lib/constants";

/**
 * The staff reservation register (spec 14, F8).
 *
 * **Three tabs, and Ready is the one that opens.** A librarian opening this screen is almost
 * always answering "is a copy sitting on the shelf with somebody's name on it?", which is the
 * Ready tab. It is also the only tab with actions — a `waiting` hold has no copy set aside,
 * so there is nothing to fulfil — and a waiting row says so instead of offering a button
 * that is guaranteed to fail.
 *
 * **History is three statuses in one request.** `?status=fulfilled,cancelled,expired` is a
 * single paginated call; asking for "not active" in three round trips would make the tab a
 * lie the moment one of them failed, and omitting the filter entirely is unbounded.
 *
 * **Both layouts render from one array**, with the status line and the timeline sentence
 * built by shared helpers rather than restated per layout — the Unit 08 decision, because two
 * copies of a row shape is how the desk and a phone disagree about a hold's state.
 *
 * The count is `aria-live` and comes from `meta.total`, not `items.length`, so paging cannot
 * quietly change the number on screen.
 */
const PAGE_SIZE = 50;

type TabValue = "ready" | "waiting" | "history";

const TABS: ReadonlyArray<{
  value: TabValue;
  label: string;
  statuses: readonly ReservationStatus[];
  empty: string;
  describe: string;
}> = [
  {
    value: "ready",
    label: "Ready",
    statuses: ["ready"],
    empty: "No copies are being held",
    describe:
      "Nothing is set aside for anybody right now. A copy lands here the moment a book is returned to somebody who was waiting for it.",
  },
  {
    value: "waiting",
    label: "Waiting",
    statuses: ["waiting"],
    empty: "Nobody is queuing",
    describe:
      "No member is waiting for a book. Queues appear here as soon as somebody joins one from a book page.",
  },
  {
    value: "history",
    label: "History",
    statuses: ["fulfilled", "cancelled", "expired"],
    empty: "No closed holds yet",
    describe:
      "Holds that were collected, cancelled or left to expire. This is the record of who waited and what happened to them.",
  },
];

export function ReservationsManager() {
  const [tab, setTab] = React.useState<TabValue>("ready");
  const [page, setPage] = React.useState(1);
  const [fulfilling, setFulfilling] = React.useState<ReservationSummary | null>(null);
  const [cancelling, setCancelling] = React.useState<ReservationSummary | null>(null);

  const active = TABS.find((entry) => entry.value === tab) ?? TABS[0];

  const { data, error, isLoading, mutate } = useSWR(
    `/api/reservations?limit=${PAGE_SIZE}&page=${page}&status=${active.statuses.join(",")}`,
    async () =>
      reservationsApi.list({ status: [...active.statuses], limit: PAGE_SIZE, page }),
  );

  const rows = data?.data.items ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;
  const shownPage = data?.meta?.page ?? page;

  // Changing tab must start at page 1, or a librarian who paged to the end of History and
  // then opened Waiting lands on an empty page and concludes there are no queues.
  const openTab = (value: TabValue) => {
    setTab(value);
    setPage(1);
  };

  const fulfil = async () => {
    if (!fulfilling) return;
    const target = fulfilling;

    try {
      const result = await reservationsApi.fulfil(target.id);
      toast.success(`Issued to ${target.member.name}`, {
        description: `“${target.book.title}” is now due ${formatDate(result.loan.dueDate)}.`,
      });
      void mutate();
    } catch (err) {
      toast.error("Could not issue this book", {
        description: toErrorMessage(err, "Please try again."),
      });
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    const target = cancelling;

    try {
      await reservationsApi.cancel(target.id);
      toast.success("Reservation cancelled", {
        description:
          target.status === "ready"
            ? `The hold on “${target.book.title}” has been released and the copy is back on the shelf.`
            : `${target.member.name} is no longer waiting for “${target.book.title}”.`,
      });
      // Releasing a ready hold promotes the next member, so the Waiting tab's contents
      // genuinely change as a result — re-read rather than assume.
      void mutate();
    } catch (err) {
      toast.error("Could not cancel that reservation", {
        description: toErrorMessage(err, "Please try again."),
      });
    }
  };

  const actions = { onFulfil: setFulfilling, onCancel: setCancelling };

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Reservations"
        description="Copies being held, queues waiting, and everything already closed."
      />

      <section aria-labelledby="reservation-register-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="reservation-register-heading"
            className="font-display text-h3 font-semibold tracking-[-0.02em] text-foreground"
          >
            Register
          </h2>
          <p aria-live="polite" className="text-small text-muted-foreground">
            {isLoading && !data
              ? "Loading…"
              : `${total} ${total === 1 ? "reservation" : "reservations"}`}
          </p>
        </div>

        {/*
          * `inline-flex w-fit` cannot wrap, so four triggers at these labels overflow a 390px
          * viewport. Three short labels do not, and the section heading above already says
          * "Register" — the same shortening Unit 12 applied to the desk tabs.
        */}
        <Tabs value={tab} onValueChange={(value) => openTab(value as TabValue)}>
          <TabsList>
            {TABS.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error && !data ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-small text-danger-ink">
              {error instanceof Error ? error.message : "Something went wrong."}
            </p>
            <Button variant="outline" className="mt-3" onClick={() => void mutate()}>
              Try again
            </Button>
          </div>
        ) : isLoading && rows.length === 0 ? (
          <RegisterSkeleton />
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface">
            <EmptyState
              icon={Clock}
              title={active.empty}
              description={active.describe}
              action={
                <Button asChild variant="outline">
                  <Link href="/catalog">Browse the catalog</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* --------------------------- Desktop table --------------------------- */}
            <div className="hidden overflow-hidden rounded-lg border border-border bg-surface lg:block">
              <table className="w-full text-left">
                <thead className="bg-muted text-caption font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="min-w-[13rem] px-4 py-3">Book</th>
                    <th scope="col" className="px-4 py-3">Member</th>
                    <th scope="col" className="px-4 py-3">Position</th>
                    <th scope="col" className="px-4 py-3">Dates</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((reservation) => (
                    <tr
                      key={reservation.id}
                      className="border-t border-border transition-colors hover:bg-muted/50"
                    >
                      <td className="min-w-[14rem] max-w-[22rem] px-4 py-3">
                        {/*
                          * `min-w` rather than only `max-w`: `w-full` on the table hands the
                          * slack to the narrow columns, and the book title — the one column a
                          * librarian is actually reading — collapsed to "No longer in the…".
                          * Caught by reading a screenshot; every assertion on this screen
                          * passed while it did it, exactly as the Unit 07 category cards did.
                          */}
                        <BookTitle
                          book={reservation.book}
                          className="line-clamp-1 text-small font-medium text-foreground"
                        />
                        <p className="line-clamp-1 text-caption text-muted-foreground">
                          {reservation.book.authors.join(", ") || "Unknown author"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6 shrink-0">
                            <AvatarFallback className="text-[10px]">
                              {initials(reservation.member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            {reservation.member.id && reservation.member.name !== "Unknown member" ? (
                              <Link
                                href={`/staff/members/${reservation.member.id}`}
                                className="block truncate text-small text-foreground underline-offset-2 hover:underline"
                              >
                                {reservation.member.name}
                              </Link>
                            ) : (
                              // `memberRefOr` hands back an "Unknown member" placeholder with
                              // an id that may not resolve. Linking it would send a librarian
                              // to a member record that does not exist.
                              <span className="block truncate text-small text-muted-foreground">
                                {reservation.member.name}
                              </span>
                            )}
                            {reservation.member.membershipId ? (
                              <span className="block font-mono text-caption text-muted-foreground">
                                {reservation.member.membershipId}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-small tabular-nums whitespace-nowrap text-muted-foreground">
                        {reservation.queuePosition ? `#${reservation.queuePosition}` : "—"}
                      </td>
                      {/*
                        * Requested **and** expiry share one two-line cell rather than two
                        * columns. Seven columns do not fit beside a 264px sidebar at 1280 —
                        * the first attempt at a roomier book column pushed the actions menu
                        * out of the `overflow-hidden` wrapper, so it was clipped away with
                        * nothing to indicate it. Both dates are still shown, on the vertical
                        * space the row already had going spare.
                        */}
                      <td className="px-4 py-3">
                        <p className="text-small whitespace-nowrap text-muted-foreground">
                          {formatDate(reservation.requestedAt)}
                        </p>
                        <p className="text-caption whitespace-nowrap text-muted-foreground">
                          {reservation.status === "ready"
                            ? `expires ${formatDate(reservation.expiresAt, "d MMM, HH:mm")}`
                            : reservation.status === "cancelled"
                              ? `cancelled ${formatDate(reservation.cancelledAt)}`
                              : reservation.status === "fulfilled"
                                ? "loan created"
                                : "no copy held yet"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <ReservationStatusLine reservation={reservation} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {reservation.status === "ready" ? (
                          <ReservationRowActionMenu reservation={reservation} actions={actions} />
                        ) : (
                          <span className="text-caption text-muted-foreground">
                            {closedLabel(reservation)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ---------------------------- Mobile cards ---------------------------- */}
            <ul className="space-y-3 lg:hidden">
              {rows.map((reservation) => (
                <ReservationCard key={reservation.id} reservation={reservation} actions={actions} />
              ))}
            </ul>

            {/*
             * A capped list must say it is capped, and it must offer a way past the cap.
             * `meta.total` is every reservation in this tab, while `rows` is one page of
             * them — without this a librarian with four hundred closed holds sees fifty and
             * no indication that three hundred and fifty exist. This was invisible to every
             * assertion until the History tab was screenshotted, which is the Unit 07 lesson
             * again: the checks all passed over a register quietly truncating itself.
             */}
            {totalPages > 1 ? (
              <nav
                aria-label="Reservations pagination"
                className="flex flex-col items-center gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between"
              >
                <p className="text-small text-muted-foreground">
                  Page {shownPage} of {totalPages} &middot; showing {rows.length} of {total}
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
            ) : total > rows.length ? (
              <p className="text-caption text-muted-foreground">
                Showing {rows.length} of {total}.
              </p>
            ) : null}
          </>
        )}
      </section>

      {/*
        * Neither dialog clears its target before the request runs. `ConfirmDialog` closes
        * itself once `onConfirm` resolves, so nulling it early would unmount the title and
        * consequence text the librarian is reading while the request is still in flight.
        */}
      <ConfirmDialog
        open={fulfilling !== null}
        onOpenChange={(open) => {
          if (!open) setFulfilling(null);
        }}
        title={`Issue “${fulfilling?.book.title ?? ""}” to ${fulfilling?.member.name ?? ""}?`}
        consequence="This closes their hold and starts the loan period today. They are notified and the book appears under their loans straight away."
        confirmLabel="Issue to member"
        destructive={false}
        onConfirm={fulfil}
      />

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title={`Cancel this reservation for ${cancelling?.member.name ?? ""}?`}
        consequence={
          cancelling?.status === "ready"
            ? "This releases the copy being held, puts it straight back on the shelf and offers it to the next member in the queue."
            : "The member loses their place in this queue and is told it has been cancelled."
        }
        confirmLabel="Cancel reservation"
        onConfirm={cancel}
      />
    </div>
  );
}

/** Skeleton matching the register's row shape so the layout does not jump. */
function RegisterSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading reservations">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
          <Skeleton className="size-10 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}