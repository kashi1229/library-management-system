"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InitialAvatar } from "@/components/common/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { authApi } from "@/lib/api-client";
import { ROUTES, type Role } from "@/lib/constants";
import type { PublicUser } from "@/types";

const ROLE_LABEL: Record<Role, string> = {
  member: "Member",
  librarian: "Librarian",
  admin: "Administrator",
};

/**
 * Avatar menu: identity, role, membership ID, profile, theme and sign out.
 *
 * Sign-out calls the API (so the cookie is cleared server-side) and only then
 * navigates, with a toast confirming the action.
 */
export function UserMenu({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authApi.logout();
      toast.success("Signed out", { description: "See you at the next visit." });
      router.replace(ROUTES.login);
      router.refresh();
    } catch {
      toast.error("Could not sign you out", { description: "Please try again." });
      setSigningOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-2 pr-2 pl-1"
          aria-label={`Account menu for ${user.name}`}
        >
          <InitialAvatar name={user.name} imageUrl={user.avatar?.url} size="sm" />
          <span className="hidden max-w-32 truncate text-small font-medium lg:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case">
          <div className="flex items-start gap-3">
            <InitialAvatar name={user.name} imageUrl={user.avatar?.url} size="md" />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-small font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-caption text-muted-foreground">{user.email}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Badge variant="secondary" className="text-[10px]">
                  {ROLE_LABEL[user.role]}
                </Badge>
                {user.membershipId ? (
                  <span className="font-mono text-code text-muted-foreground">{user.membershipId}</span>
                ) : null}
              </div>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={ROUTES.member.profile}>
              <span>Profile &amp; settings</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-small text-muted-foreground">Appearance</span>
          <ThemeToggle />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
          disabled={signingOut}
          className="text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
