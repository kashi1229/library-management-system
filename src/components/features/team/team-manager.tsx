"use client";

import * as React from "react";
import useSWR from "swr";
import { RotateCcw, ShieldOff, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, initials } from "@/lib/utils";
import { AddLibrarianDialog } from "@/components/features/team/add-librarian-dialog";
import { teamApi, type TeamMember } from "@/lib/api-client";

/**
 * Staff account administration (F1, F6). **Admin only.**
 *
 * The page already redirects a librarian (`src/app/staff/team/page.tsx`) and every
 * route calls `requireAdmin()`; this component assumes a real admin is present.
 *
 * Two rules are enforced server-side in `updateTeamMember` and surfaced here rather
 * than duplicated: you cannot disable **yourself**, and you cannot disable the **last
 * active admin**. Both would leave the library with nobody who can restore staff
 * accounts, so the buttons are disabled with a tooltip explaining why rather than
 * failing after the fact.
 */
export function TeamManager({ currentUserId }: { currentUserId: string }) {
  const [adding, setAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // Keyed on the pathname, like every other manager in the app. There is no filter to
  // put in the key here, so a plain string is the whole identity — but the fetcher still
  // takes **no parameters**, because SWR passes the key as the first argument and a
  // `(signal?: AbortSignal)` parameter would hand that string to `fetch`.
  const { data, error, isLoading, mutate } = useSWR("/staff/team", () => teamApi.list());

  const team = data ?? [];
  const activeAdmins = team.filter((m) => m.role === "admin" && m.status === "active").length;

  const setStatus = async (member: TeamMember, status: "active" | "suspended") => {
    setBusyId(member.id);
    try {
      await teamApi.update(member.id, { status });
      toast.success(
        status === "suspended"
          ? `${member.name} can no longer sign in`
          : `${member.name} has been reinstated`,
      );
      void mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That change could not be saved", {
        description: "Please try again.",
      });
    } finally {
      setBusyId(null);
    }
  };

  const rename = async (member: TeamMember) => {
    // A prompt is not a form, but renaming is rare and the field is a single required
    // value; a dialog here would be more machinery than the task deserves.
    const next = window.prompt("New name for this staff account:", member.name);
    if (next === null) return;

    const trimmed = next.trim();
    if (trimmed === member.name) return;
    if (trimmed.length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }

    setBusyId(member.id);
    try {
      await teamApi.update(member.id, { name: trimmed });
      toast.success("Name updated");
      void mutate();
    } catch {
      toast.error("That name could not be saved", { description: "Please try again." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container-page space-y-6">
      <PageHeader
        title="Staff accounts"
        description="Librarians manage the catalog, members and circulation. Administrators also manage settings and staff."
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Add librarian
          </Button>
        }
      />

      {error ? (
        <EmptyState
          icon={Users}
          title="The staff list could not be loaded"
          description={error instanceof Error ? error.message : "Something went wrong."}
          action={<Button onClick={() => void mutate()}>Try again</Button>}
        />
      ) : isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading staff">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
            >
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : team.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Users}
            title="No staff accounts"
            description="Add a librarian to give someone access to the catalog and circulation desk."
            action={
              <Button onClick={() => setAdding(true)}>
                <UserPlus className="size-4" aria-hidden="true" />
                Add librarian
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {team.map((member) => {
            const isSelf = member.id === currentUserId;
            const lastAdmin = member.role === "admin" && activeAdmins <= 1;
            const disabledReason = isSelf
              ? "You cannot change the status of your own account"
              : lastAdmin
                ? "This is the only active administrator"
                : undefined;

            return (
              <li
                key={member.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4"
              >
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-small font-medium text-foreground">
                      {member.name}
                    </p>
                    <Badge variant={member.role === "admin" ? "info" : "secondary"}>
                      {member.role === "admin" ? "Administrator" : "Librarian"}
                    </Badge>
                    {isSelf ? <Badge variant="outline">You</Badge> : null}
                  </div>

                  <p className="mt-0.5 truncate text-caption text-muted-foreground">
                    {member.email}
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    Joined {formatDate(member.createdAt)}
                    {member.lastLoginAt ? ` · last seen ${formatDate(member.lastLoginAt)}` : " · never signed in"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={member.status} />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${member.name}`}
                        // Locked while this row's mutation is in flight, so a second
                        // click cannot queue a conflicting status change behind it.
                        disabled={busyId === member.id}
                        className="text-muted-foreground"
                      >
                        <MoreHorizontal className="size-4" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuItem onSelect={() => void rename(member)}>
                        Rename account
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        disabled={Boolean(disabledReason)}
                        // `title` on a disabled item is unreliable for keyboard and touch
                        // users, so the reason is also in the sr-only text below.
                        title={disabledReason}
                        onSelect={() =>
                          void setStatus(
                            member,
                            member.status === "suspended" ? "active" : "suspended",
                          )
                        }
                        className={
                          member.status === "active"
                            ? "text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
                            : undefined
                        }
                      >
                        {member.status === "active" ? (
                          <ShieldOff className="size-4" aria-hidden="true" />
                        ) : (
                          <ShieldCheck className="size-4" aria-hidden="true" />
                        )}
                        {member.status === "active" ? "Disable account" : "Re-enable account"}
                        {disabledReason ? (
                          <span className="sr-only"> — {disabledReason}</span>
                        ) : null}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Passwords are never emailed. Use the team member&rsquo;s own record to reset one.
      </p>

      <AddLibrarianDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={() => void mutate()}
      />
    </div>
  );
}