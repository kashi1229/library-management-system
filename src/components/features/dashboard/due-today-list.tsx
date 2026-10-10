import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { DashboardList } from "@/components/features/dashboard/dashboard-list";
import type { LoanBookRef, LoanMemberRef } from "@/types";

type DueTodayRow = {
  id: string;
  book: LoanBookRef;
  member: LoanMemberRef;
  dueDate: string;
};

/**
 * Loans due back today.
 *
 * **Due today, not overdue** (`services/dashboard.ts`). A librarian's morning question is "what
 * is coming back before it is late", which is the one list on this screen that is actionable
 * today. Overdue already has a KPI card above it, and a number is the right shape for that.
 *
 * **The time is printed, not the date.** Every row's date is the same day, so eight copies of
 * "10 Oct 2026" is noise; "by 5:00 pm" is the fact that distinguishes one row from its neighbour
 * and the reason a librarian orders the desk's calls.
 */
export function DueTodayList({ loans }: { loans: DueTodayRow[] }) {
  return (
    <DashboardList
      title="Due today"
      description={
        loans.length > 0
          ? `${loans.length} expected back, before they become overdue.`
          : undefined
      }
      items={loans.length}
      emptyTitle="Nothing due today"
      emptyDescription="No loan falls due today. Anything already late is counted above."
    >
      {loans.map((loan) => {
        const due = new Date(loan.dueDate);
        const time = Number.isNaN(due.getTime())
          ? null
          : due.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

        return (
          <div key={loan.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-small text-foreground">{loan.book.title}</p>
              <p className="mt-0.5 truncate text-caption text-muted-foreground">
                {memberLabel(loan.member)}
              </p>
            </div>
            {time ? (
              <span className="shrink-0 text-caption tabular-nums text-muted-foreground">by {time}</span>
            ) : null}
            {/* Goes to the desk, where returning a loan actually happens — not to a
                hypothetical per-loan page that does not exist. */}
            <Link
              href={ROUTES.staff.circulation}
              className="shrink-0 text-caption font-medium text-primary underline-offset-4 hover:underline"
            >
              Desk
            </Link>
          </div>
        );
      })}
    </DashboardList>
  );
}

/**
 * A member is shown by name and membership id.
 *
 * **No `?? "Unknown member"` fallback here**, because `memberRefOr` (`lib/services/refs.ts`)
 * already returns that literal for a member document that no longer exists — a loan outlives the
 * member it was issued to, since loans are never deleted (invariant 10). The type says `name` is
 * a `string` for the same reason. Re-guarding it here would be a second answer to a question
 * that has already been answered, in a place that would have to be kept in step.
 */
function memberLabel(member: LoanMemberRef): string {
  return member.membershipId ? `${member.name} · ${member.membershipId}` : member.name;
}