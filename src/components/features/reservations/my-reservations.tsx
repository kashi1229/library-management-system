"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import { Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  ReservationCard,
  ReservationHistoryRow,
  ReservationSection,
  ReservationsSkeleton,
  holdIcon,
} from "@/components/features/reservations/reservation-card";
import { reservationsApi, toErrorMessage, type MemberReservation } from "@/lib/api-client";

/**
 * A member's own holds (spec 14, F8).
 *
 * **Three sections, not tabs.** A tab that says "Ready" with no number is a question the
 * member has to click to answer, and the reason they opened this page is almost always "is
 * my book ready yet". Ready holds are therefore pinned to the top with the countdown the
 * server derived, and only then does the queue appear â€” the order is the urgency order.
 *
 * **`GET /api/reservations/mine` takes no member id** â€” it is resolved from the session
 * (invariant 3), so nothing here can reach somebody else's queue â€” and it returns the three
 * groups already built. Grouping a paginated list in the browser would silently drop rows
 * the moment a member had more than one page of history, which is what "Past" always is.
 *
 * **`pastTotal` is compared against the rows shown.** A capped list that renders no note
 * reads as "this is everything", and a member whose holds have a story behind them deserves
 * to be told the list is the most recent 50 rather than being left to assume otherwise.
 *
 * Cancelling a `ready` hold really does release the copy, so the dialog says so rather than
 * saying "are you sure?", which tells a member nothing about what they are giving up.
 */
export function MyReservations() {
  const [confirmCancel, setConfirmCancel] = React.useState<MemberReservation | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    "/api/reservations/mine",
    // No positional parameters: SWR passes the **cache key** as the first argument, so a
    // `(signal?: AbortSignal)` parameter would hand that string straight to `fetch`.
    async () => reservationsApi.mine(),
  );

  const ready = data?.ready ?? [];
  const waiting = data?.waiting ?? [];
  const past = data?.past ?? [];
  const pastTotal = data?.pastTotal ?? 0;

  /*
   * `confirmCancel` is deliberately **not** cleared before the request runs. `ConfirmDialog`
   * closes itself once `onConfirm` resolves, and clearing the target here would unmount the
   * title and consequence text the member is reading while the request is still in flight.
   */
  const cancel = async () => {
    if (!confirmCancel) return;
    const target = confirmCancel;
    setPendingId(target.id);

    try {
      await reservationsApi.cancel(target.id);
      toast.success(target.status === "ready" ? "Hold released" : "Reservation cancelled", {
        description:
          target.status === "ready"
            ? `â€œ${target.book.title}â€ is available to borrow again.`
            : `You are no longer waiting for â€œ${target.book.title}â€.`,
      });
      void mutate();
    } catch (err) {
      toast.error("Could not cancel that reservation", {
        description: toErrorMessage(err, "Please try again."),
      });
    } finally {
      setPendingId(null);
    }
  };

  const hasAny = ready.length + waiting.length + past.length > 0;

  return (
    <div className="container-page space-y-8">
      <PageHeader
        title="Reservations"
        description="Books you are waiting for, and copies the library is holding for you."
        action={
          <Button asChild variant="outline">
            <Link href="/catalog">
              <Library className="size-4" aria-hidden="true" />
              Browse the catalog
            </Link>
          </Button>
        }
      />

      {error && !data ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Library}
            title="Could not load your holds"
            description={error instanceof Error ? error.message : "Something went wrong."}
            action={
              <Button onClick={() => void mutate()}>
                Try again
              </Button>
            }
          />
        </div>
      ) : isLoading && !data ? (
        <ReservationsSkeleton count={3} />
      ) : !hasAny ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={holdIcon("waiting")}
            title="No reservations yet"
            description="When every copy of a book is out, you can join its queue from the book page and we will hold the next one that comes back."
            action={
              <Button asChild>
                <Link href="/catalog">Find a book</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* --------------------------- Ready to collect -------------------------- */}
          {/*
            * Rendered first and only when non-empty. A permanently-present "Ready" heading
            * on a page with nothing ready is a section that always reads as a failure.
            */}
          {ready.length > 0 ? (
            <ReservationSection
              title="Ready to collect"
              count={ready.length}
              description="a copy is being held at the circulation desk"
            >
              <ul className="space-y-3">
                {ready.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    pending={pendingId === reservation.id}
                    onCancel={setConfirmCancel}
                  />
                ))}
              </ul>
            </ReservationSection>
          ) : null}

          {/* ------------------------------- Waiting ------------------------------- */}
          {waiting.length > 0 ? (
            <ReservationSection
              title="Waiting"
              count={waiting.length}
              description="in the queue, no copy held yet"
            >
              <ul className="space-y-3">
                {waiting.map((reservation) => (
                  <ReservationCard
                    key={reservation.id}
                    reservation={reservation}
                    pending={pendingId === reservation.id}
                    onCancel={setConfirmCancel}
                  />
                ))}
              </ul>
            </ReservationSection>
          ) : null}

          {/* -------------------------------- Past --------------------------------- */}
          {past.length > 0 ? (
            <ReservationSection
              title="Past"
              count={pastTotal}
              description="collected, cancelled or expired"
            >
              <ul className="space-y-3">
                {past.map((reservation) => (
                  <ReservationHistoryRow key={reservation.id} reservation={reservation} />
                ))}
              </ul>
              {/*
                * A capped list must say it is capped. `pastTotal` is the real count across
                * every closed reservation ever, and `past` is the most recent
                * `MEMBER_HISTORY_LIMIT` of them.
                */}
              {pastTotal > past.length ? (
                <p className="text-caption text-muted-foreground">
                  Showing the {past.length} most recent of {pastTotal}.
                </p>
              ) : null}
            </ReservationSection>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={confirmCancel !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCancel(null);
        }}
        title={confirmCancel?.status === "ready" ? "Release this hold?" : "Cancel this reservation?"}
        consequence={
          confirmCancel?.status === "ready"
            ? "The copy is being held for you right now. Releasing it puts the book back on the shelf and offers it to the next reader in the queue."
            : "You will lose your place in this queue. If a copy has already been returned you will have to join the queue again from the end."
        }
        confirmLabel={confirmCancel?.status === "ready" ? "Release hold" : "Cancel reservation"}
        onConfirm={cancel}
      />
    </div>
  );
}