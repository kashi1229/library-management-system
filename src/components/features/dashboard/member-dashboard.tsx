"use client";

import Link from "next/link";
import { StatCard } from "@/components/common/stat-card";
import { BookMarked, Clock, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import { PickupBanner } from "@/components/features/dashboard/pickup-banner";
import { ReadingScroller } from "@/components/features/dashboard/reading-scroller";
import { RecommendedRow } from "@/components/features/dashboard/recommended-row";
import type { MemberDashboard } from "@/types";

/**
 * The member dashboard body.
 *
 * **A Client Component, and the reason is `StatCard`, not interactivity.** `StatCard` is
 * `"use client"` (it count-ups on entry to view), and it takes an `icon` prop. A Lucide icon is a
 * *function*, and React's server-to-client boundary serialises data, not functions — so a Server
 * Component passing `icon={BookMarked}` produces:
 *
 * ```
 * Only plain objects can be passed to Client Components from Server Components.
 * Classes or other objects with methods are not supported.
 *   <StatCard label=… value={3} icon={{$$typeof: …, render: …}} />
 * ```
 *
 * `tsc` is happy, `next build` is happy, and the page throws in the browser — which is exactly
 * why the browser pass exists. The fix is the same one `features/members/member-header.tsx`
 * already uses for its four `StatCard`s. The staff half got this right first time because
 * `staff-dashboard.tsx` was written as a Client Component from the start.
 *
 * Every figure arrives as a prop from `getMemberDashboard`, which already returns plain objects
 * with string ids and ISO dates — so there is no serialisation step and no client fetch.
 */
export function MemberDashboard({
  data,
  loanPeriod,
}: {
  data: MemberDashboard;
  /** From `getSettings()`, so the countdown ring scales against real policy. */
  loanPeriod: number;
}) {
  const { kpis } = data;

  return (
    <div className="space-y-8">
      <PickupBanner pickups={data.pickups} />

      <section aria-labelledby="your-library" className="space-y-4">
        <h2 id="your-library" className="sr-only">
          Your library at a glance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Active loans"
            value={kpis.activeLoans}
            icon={BookMarked}
            hint={
              <Link className="underline-offset-4 hover:underline" href={ROUTES.member.loans}>
                See your loans
              </Link>
            }
          />
          <StatCard
            label="Ready holds"
            value={kpis.readyHolds}
            icon={Clock}
            tone={kpis.readyHolds > 0 ? "info" : "default"}
            hint={
              kpis.readyHolds > 0 ? (
                "Waiting at the desk"
              ) : (
                <Link className="underline-offset-4 hover:underline" href={ROUTES.member.reservations}>
                  Reserve a book
                </Link>
              )
            }
          />
          {/* **The count is the value; the money is the hint.** The first draft passed
              `format={formatCurrency}` here, which turned "1 unpaid fine" into "$1.00" — the
              `format` prop formats whichever number it is given, and it was being given the
              count. This is Unit 13's lesson pointed the other way: `format` exists because a
              *count* and an *amount* must not be rendered the same, and it only helps when it is
              applied to the amount. Same shape as the staff "Unpaid fines" card, so both
              dashboards read identically. */}
          <StatCard
            label="Outstanding fines"
            value={kpis.unpaidFines}
            icon={Receipt}
            tone={kpis.unpaidFines > 0 ? "danger" : "success"}
            hint={
              kpis.unpaidFines > 0 ? (
                <>
                  <span className="block">{formatCurrency(kpis.unpaidFineTotal)} to settle</span>
                  <Link className="underline-offset-4 hover:underline" href={ROUTES.member.fines}>
                    Settle at the desk
                  </Link>
                </>
              ) : (
                "Nothing to pay"
              )
            }
          />
        </div>
      </section>

      <ReadingScroller loans={data.reading} loanPeriod={loanPeriod} />

      <RecommendedRow
        title="Recommended for you"
        description="Based on what you have borrowed"
        books={data.recommended}
        emptyTitle="Nothing to recommend yet"
        emptyDescription="Borrow a couple of books and this fills with more from the shelves you read."
        emptyAction={{ label: "Browse the catalog", href: ROUTES.catalog }}
      />

      {/* Only rendered when there is something on the list. A permanent "Your wishlist — nothing
          yet" panel is a dead block on the screen every member meets first; the wishlist link is
          already in the sidebar and the bottom tab bar. */}
      {data.wishlist.length > 0 ? (
        <RecommendedRow
          title="Your wishlist"
          books={data.wishlist}
          emptyTitle=""
          emptyDescription=""
        />
      ) : null}
    </div>
  );
}