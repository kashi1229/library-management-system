"use client";

import Link from "next/link";
import { MoreHorizontal, RotateCcw, ShieldAlert, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MemberSummary } from "@/lib/api-client";

/** What the row menu can do. Owned by the table, so the menu stays dumb. */
export type MemberRowActions = {
  onSuspend: (member: MemberSummary) => void;
  onActivate: (member: MemberSummary) => void;
  onResetPassword: (member: MemberSummary) => void;
};

/**
 * Per-member overflow menu.
 *
 * The destructive action changes with the member's state rather than sitting behind a
 * disabled item: a "Suspend" that is greyed out on an already-suspended member is
 * noise, and a permanently visible "Activate" on an active one invites a misclick.
 *
 * Both labels are explicit about the consequence, and the destructive item is tinted
 * `danger` **and** worded, so the choice never rests on colour alone.
 */
export function MemberRowActionMenu({
  member,
  actions,
}: {
  member: MemberSummary;
  actions: MemberRowActions;
}) {
  const suspended = member.status === "suspended";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${member.name}`}
          className="shrink-0 text-muted-foreground"
        >
          <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem asChild>
          <Link href={`/staff/members/${member.id}`}>View full record</Link>
        </DropdownMenuItem>

        <DropdownMenuItem onSelect={() => actions.onResetPassword(member)}>
          <RotateCcw className="size-4" strokeWidth={1.75} aria-hidden="true" />
          Reset password
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {suspended ? (
          <DropdownMenuItem onSelect={() => actions.onActivate(member)}>
            <UserCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Reinstate access
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={() => actions.onSuspend(member)}
            className="text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
          >
            <ShieldAlert className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Suspend access
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}