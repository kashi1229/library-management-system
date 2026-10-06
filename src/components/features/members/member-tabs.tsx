"use client";

import * as React from "react";
import {
  BookMarked,
  ClipboardList,
  Clock,
  FileText,
  Hourglass,
  Receipt,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";

/**
 * The detail page's tab strip (spec 10).
 *
 * Four tabs, of which only Overview has content today. **The other three say exactly
 * which unit will fill them** rather than rendering an empty panel — an empty tab with
 * no explanation is indistinguishable from a bug, whereas "Loans arrive with
 * circulation" tells a librarian the screen is not broken.
 *
 * Tabs that have no data are still focusable and announce themselves, so a screen
 * reader user can discover what is coming rather than silently missing three sections.
 */
export function MemberTabs() {
  return (
    <Tabs defaultValue="overview" className="space-y-5">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">
          <Sparkles className="size-4" aria-hidden="true" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="loans">
          <BookMarked className="size-4" aria-hidden="true" />
          Loans
        </TabsTrigger>
        <TabsTrigger value="fines">
          <Receipt className="size-4" aria-hidden="true" />
          Fines
        </TabsTrigger>
        <TabsTrigger value="reservations">
          <Clock className="size-4" aria-hidden="true" />
          Reservations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewPanel />
      </TabsContent>

      <TabsContent value="loans">
        <ComingSoon
          icon={ClipboardList}
          title="Loan history"
          description="Every loan, return and renewal for this member appears here once circulation is switched on."
          unit="circulation"
        />
      </TabsContent>

      <TabsContent value="fines">
        <ComingSoon
          icon={Receipt}
          title="Fines"
          description="Fines are raised when a book comes back late, so this tab fills in with the fines feature."
          unit="fines"
        />
      </TabsContent>

      <TabsContent value="reservations">
        <ComingSoon
          icon={Hourglass}
          title="Reservations"
          description="Holds and queue positions arrive with reservations. The count in the summary above is already live."
          unit="reservations"
        />
      </TabsContent>
    </Tabs>
  );
}

/**
 * Overview: the facts that are already known and worth restating in one place.
 *
 * Deliberately not a duplicate of the header — the header answers "who is this and
 * what can I do", this answers "when did they join and how do I reach them".
 */
function OverviewPanel() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-soft">
      <h2 className="text-h3 font-display font-semibold text-foreground">About this record</h2>
      <p className="mt-2 max-w-2xl text-body text-pretty text-muted-foreground">
        This member&rsquo;s full history lives on the tabs above. Their name, email and
        membership ID are editable by the member from their own profile; a librarian
        cannot change them here, which is deliberate a member&rsquo;s own details are
        the ones they can vouch for.
      </p>
    </div>
  );
}

/**
 * A tab that is present but empty.
 *
 * The unit is named so the wait is finite and checkable rather than feeling like an
 * oversight.
 */
function ComingSoon({
  icon,
  title,
  description,
  unit,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  unit: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={
        <>
          {description}{" "}
          <span className="text-muted-foreground/80">
            <FileText className="inline size-3.5" aria-hidden="true" /> Arrives with the {unit} work.
          </span>
        </>
      }
    />
  );
}