"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookCheck,
  BookOpen,
  BookPlus,
  Hourglass,
  IdCard,
  KeyRound,
  Mail,
  Phone,
  GraduationCap,
  Receipt,
  ShieldOff,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { StatCard } from "@/components/common/stat-card";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { membersApi, type MemberDetail } from "@/lib/api-client";
import { SuspendDialog } from "@/components/features/members/suspend-dialog";
import { ResetPasswordDialog } from "@/components/features/members/reset-password-dialog";

/**
 * Member detail header (spec 10).
 *
 * Four `StatCard`s then a contact block then the actions. The actions change with
 * status rather than disabling a button — a greyed-out "Reinstate" on an active member
 * is noise, and a permanently live "Suspend" invites a misclick.
 *
 * The suspension reason, when present, is shown **on this screen** rather than only on
 * the member's own banner. The person who typed it needs to see what they typed, and
 * the person reading over their shoulder needs to see what was applied.
 */
export function MemberHeader({ member }: { member: MemberDetail }) {
  const router = useRouter();
  const [suspending, setSuspending] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [reinstating, setReinstating] = React.useState(false);

  const suspended = member.status === "suspended";

  const reinstate = async () => {
    setReinstating(true);
    try {
      await membersApi.activate(member.id);
      toast.success(`${member.name} can borrow again`, {
        description: "The suspension reason has been cleared.",
      });
      router.refresh();
    } catch {
      toast.error("Could not reinstate this member", { description: "Please try again." });
    } finally {
      setReinstating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar size="lg" className="size-20 shrink-0">
          {member.avatar ? (
            <AvatarImage src={member.avatar.url} alt="" />
          ) : (
            <AvatarFallback className="bg-primary-soft text-h3 text-primary">
              {initials(member.name)}
            </AvatarFallback>
          )}
        </Avatar>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h2 font-display font-semibold tracking-[-0.02em] text-foreground">
              {member.name}
            </h1>
            <StatusBadge status={member.status} />
          </div>

          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-muted-foreground">
            {member.membershipId ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-code">
                <IdCard className="size-3.5" aria-hidden="true" />
                {member.membershipId}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5" aria-hidden="true" />
              {member.email}
            </span>
            {member.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden="true" />
                {member.phone}
              </span>
            ) : null}
            {member.department ? (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="size-3.5" aria-hidden="true" />
                {member.department}
              </span>
            ) : null}
          </p>

          <p className="text-caption text-muted-foreground">
            Member since {formatDate(member.createdAt)}
            {member.lastLoginAt ? ` · last signed in ${formatDate(member.lastLoginAt)}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {/* F6's "issue a book" quick action. It opens the desk with this member already
              chosen, so a librarian reading a member does not have to go and re-type them.
              `asChild` renders the real link, so it is openable in a new tab and has an
              href to copy — a `router.push` button would have neither. */}
          <Button variant="accent" asChild>
            <Link href={`/staff/circulation?memberId=${member.id}`}>
              <BookPlus className="size-4" aria-hidden="true" />
              Issue a book
            </Link>
          </Button>

          {suspended ? (
            <Button variant="default" onClick={reinstate} disabled={reinstating}>
              <ShieldCheck className="size-4" aria-hidden="true" />
              {reinstating ? "Reinstating…" : "Reinstate access"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setSuspending(true)}>
              <ShieldOff className="size-4" aria-hidden="true" />
              Suspend access
            </Button>
          )}

          <Button variant="outline" onClick={() => setResetting(true)}>
            <KeyRound className="size-4" aria-hidden="true" />
            Reset password
          </Button>
        </div>
      </div>

      {suspended && member.suspendedReason ? (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3">
          <p className="text-caption font-semibold tracking-wide text-danger-ink uppercase">
            Suspended
          </p>
          <p className="mt-1 text-small text-danger-ink">{member.suspendedReason}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active loans"
          value={member.activeLoans}
          icon={BookCheck}
          tone={member.activeLoans > 0 ? "info" : "default"}
          hint={member.activeLoans > 0 ? "Out with the member now" : "Nothing borrowed"}
        />
        <StatCard
          label="Borrowed all time"
          value={member.totalBorrowed}
          icon={BookOpen}
          hint="Since joining"
        />
        <StatCard
          label="Unpaid fines"
          value={member.unpaidFines}
          icon={Receipt}
          tone={member.unpaidFines > 0 ? "danger" : "success"}
          hint={
            member.unpaidFineTotal > 0
              ? `Owing ${formatCurrency(member.unpaidFineTotal)}`
              : "Nothing outstanding"
          }
        />
        <StatCard
          label="Reservations"
          value={member.activeReservations}
          icon={Hourglass}
          hint="Waiting or ready to collect"
        />
      </div>

      <SuspendDialog
        open={suspending}
        onOpenChange={setSuspending}
        member={member}
        onSuspended={() => router.refresh()}
      />

      <ResetPasswordDialog
        open={resetting}
        onOpenChange={setResetting}
        member={member}
      />
    </div>
  );
}