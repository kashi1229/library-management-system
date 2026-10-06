"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, initials } from "@/lib/utils";
import { MemberRowActionMenu, type MemberRowActions } from "@/components/features/members/member-row-actions";
import type { MemberSummary } from "@/lib/api-client";

/**
 * The members table (spec 10).
 *
 * One component renders **both** layouts from the same data: a real `<table>` from
 * `md` up, stacked cards below. Duplicating the rows as JSX would let them drift, and
 * every column change would need editing twice — the failure mode the Unit 07 card
 * and the Unit 08 table both hit.
 *
 * The membership ID is the primary identifier a member quotes at a desk, so it is
 * rendered in the mono face and never truncated. The row's **name** is the link, not
 * the whole row: a table row is not a reliable click target and swallowing the
 * checkbox and menu in one big link makes both unusable.
 */
export function MembersTable({
  members,
  actions,
  emptyState,
}: {
  members: MemberSummary[];
  actions: MemberRowActions;
  emptyState?: React.ReactNode;
}) {
  if (members.length === 0) return <>{emptyState}</>;

  return (
    <>
      {/* ------------------------------ Desktop ------------------------------ */}
      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <Table containerClassName="overflow-visible">
          <TableHeader>
            <TableRow>
              {/* Placeholder column keeps the avatar row optically aligned with the
                  header. `aria-hidden` because it carries no information. */}
              <TableHead className="w-12" aria-hidden="true">
                <span className="sr-only">Avatar</span>
              </TableHead>
              <TableHead className="min-w-[14rem]">Member</TableHead>
              <TableHead className="w-36">Membership ID</TableHead>
              <TableHead className="min-w-[14rem]">Email</TableHead>
              <TableHead className="w-44">Department</TableHead>
              <TableHead className="w-24 text-center">Loans</TableHead>
              <TableHead className="w-32">Joined</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Avatar size="sm" className="size-9">
                    {member.avatar ? (
                      <AvatarImage src={member.avatar.url} alt="" />
                    ) : (
                      <AvatarFallback className="bg-primary-soft text-small text-primary">
                        {initials(member.name)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </TableCell>

                <TableCell className="whitespace-normal">
                  <Link
                    href={`/staff/members/${member.id}`}
                    className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:outline-none"
                  >
                    {member.name}
                  </Link>
                </TableCell>

                <TableCell>
                  <span className="font-mono text-code text-muted-foreground">
                    {member.membershipId ?? "—"}
                  </span>
                </TableCell>

                <TableCell className="whitespace-normal">
                  <span className="block max-w-[16rem] truncate text-small text-muted-foreground">
                    {member.email}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="block max-w-[10rem] truncate text-small text-muted-foreground">
                    {member.department ?? "—"}
                  </span>
                </TableCell>

                <TableCell className="text-center">
                  <LoanCount count={member.activeLoans} />
                </TableCell>

                <TableCell>
                  <span className="whitespace-nowrap text-small text-muted-foreground">
                    {formatDate(member.createdAt)}
                  </span>
                </TableCell>

                <TableCell>
                  <StatusBadge status={member.status} />
                </TableCell>

                <TableCell>
                  <MemberRowActionMenu member={member} actions={actions} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------- Mobile ------------------------------- */}
      <ul className="space-y-3 md:hidden">
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar className="size-10 shrink-0">
                {member.avatar ? (
                  <AvatarImage src={member.avatar.url} alt="" />
                ) : (
                  <AvatarFallback className="bg-primary-soft text-small text-primary">
                    {initials(member.name)}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/staff/members/${member.id}`}
                    className="line-clamp-2 font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {member.name}
                  </Link>
                  <MemberRowActionMenu member={member} actions={actions} />
                </div>

                <p className="mt-0.5 font-mono text-code text-muted-foreground">
                  {member.membershipId ?? "—"}
                </p>
                <p className="mt-0.5 line-clamp-1 text-caption text-muted-foreground">
                  {member.email}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={member.status} />
                  <LoanCount count={member.activeLoans} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Active loans as a badge, not a bare number.
 *
 * A member at the policy limit is the case a librarian needs to notice at a glance, so
 * the count gets a badge — but the badge tone is **deliberately uniform**.
 *
 * Escalating the tone at the limit would mean hard-coding `maxActiveLoans`, and that
 * number lives in the settings singleton (`SETTINGS_DEFAULTS.maxActiveLoans`), which is
 * changeable at runtime by an admin (architecture.md invariant 7). A `count >= 5` in
 * this component would be correct only until someone edits the policy, and then it would
 * quietly warn on the wrong members — worse than not warning at all. There is no
 * client-side settings accessor yet, so the limit is not available here; the tone becomes
 * threshold-driven when one is.
 *
 * The number itself is always rendered, so no information depends on colour.
 */
function LoanCount({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-small text-muted-foreground">0</span>;
  }
  return (
    <Badge variant="soft" className="font-mono">
      {count}
      <span className="sr-only"> active {count === 1 ? "loan" : "loans"}</span>
    </Badge>
  );
}