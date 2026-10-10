"use client";

import { formatCurrency } from "@/lib/utils";
import { StatCard } from "@/components/common/stat-card";
import {
  ArrowLeftRight,
  BookOpen,
  Clock,
  Library,
  Receipt,
  TriangleAlert,
  Users,
} from "lucide-react";
import type { StaffDashboard } from "@/types";
import { LoansAreaChart } from "@/components/features/dashboard/loans-area-chart";
import { CategoryDonut } from "@/components/features/dashboard/category-donut";
import { TopBooksBars } from "@/components/features/dashboard/top-books-bars";
import { ActivityFeed } from "@/components/features/dashboard/activity-feed";
import { LowStockList } from "@/components/features/dashboard/low-stock-list";
import { DueTodayList } from "@/components/features/dashboard/due-today-list";

/**
 * The staff dashboard body.
 *
 * **A Server Component renders `<StaffDashboard data={…} />`**, which passes the service output
 * straight down. `getStaffDashboard` already returns plain objects with string ids and ISO dates,
 * so there is no serialisation step and no client fetch — the page arrives complete, with no
 * loading flash and no second request. Only the charts are Client Components, because SVG needs
 * the browser.
 *
 * **The file is `"use client"` because three children are**, and it holds no state of its own —
 * every figure arrives as a prop and is rendered once.
 */
export function StaffDashboard({ data }: { data: StaffDashboard }) {
  const { kpis } = data;
  const out = kpis.totalCopies - kpis.availableCopies;

  return (
    <div className="space-y-6">
      {/* Eight cards, four across. `xl` only goes to four — a librarian at 1440px has room for
          two rows of four, and eight across would put each card below the width its label needs. */}
      <section aria-labelledby="library-at-a-glance">
        <h2 id="library-at-a-glance" className="sr-only">
          Library at a glance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Titles"
            value={kpis.totalTitles}
            icon={BookOpen}
            hint="Active titles in the catalog"
          />
          <StatCard
            label="Copies"
            value={kpis.totalCopies}
            icon={Library}
            hint={`${out.toLocaleString("en-US")} out or held`}
          />
          <StatCard
            label="Members"
            value={kpis.members}
            icon={Users}
            hint="Active member accounts"
          />
          <StatCard
            label="Active loans"
            value={kpis.activeLoans}
            icon={ArrowLeftRight}
            tone={kpis.activeLoans > 0 ? "default" : "success"}
            hint="Currently on loan"
          />
          {/* The two cards that can be *wrong* get a tone; the four that are just tallies do
              not. A red number has to mean something or people stop reading it. */}
          <StatCard
            label="Overdue"
            value={kpis.overdue}
            icon={TriangleAlert}
            tone={kpis.overdue > 0 ? "danger" : "success"}
            hint={kpis.overdue > 0 ? "Past their due date" : "Nothing late"}
          />
          <StatCard
            label="Ready holds"
            value={kpis.readyHolds}
            icon={Clock}
            tone={kpis.readyHolds > 0 ? "info" : "default"}
            hint="Waiting at the desk"
          />
          <StatCard
            label="Unpaid fines"
            value={kpis.unpaidFines}
            icon={Receipt}
            tone={kpis.unpaidFines > 0 ? "warning" : "success"}
            hint={formatCurrency(kpis.unpaidFineTotal)}
          />
          <StatCard
            label="On the shelf"
            value={kpis.availableCopies}
            icon={Library}
            hint="Copies available to borrow"
          />
        </div>
      </section>

      {/* The 30-day series is full width: thirty points squeezed into a third of a 1280px row
          renders one tick per three days and no visible shape. */}
      <LoansAreaChart series={data.series} days={data.seriesDays} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryDonut shares={data.byCategory} />
        <TopBooksBars books={data.topBooks} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DueTodayList loans={data.dueToday} />
        <LowStockList books={data.lowStock} />
      </div>

      <ActivityFeed items={data.activity} />
    </div>
  );
}