"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Compass, LayoutDashboard } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

/**
 * Not-found boundary for the member and staff areas.
 *
 * The root `app/not-found.tsx` covers public pages; this one is scoped to the
 * app shell so the offered destinations are the ones the visitor can actually
 * reach from where they are.
 */
export default function AppNotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-20 text-center">
      <Logo markOnly className="justify-center" />

      <div className="max-w-md space-y-3">
        <p className="font-mono text-code text-accent-ink">404</p>
        <h1 className="text-balance font-display text-h1 font-semibold tracking-[-0.02em] text-foreground">
          Page not found
        </h1>
        <p className="text-pretty text-body text-muted-foreground">
          That page is not part of the catalogue. It may have moved, or the link may be out of date.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row">
        <button type="button" onClick={() => router.back()} className={cn(buttonVariants({ variant: "outline" }))}>
          <Compass className="size-4" />
          Go back
        </button>
        <Link href={ROUTES.member.dashboard} className={cn(buttonVariants())}>
          <LayoutDashboard className="size-4" />
          Dashboard
        </Link>
        <Link href={ROUTES.catalog} className={cn(buttonVariants({ variant: "ghost" }))}>
          <BookOpen className="size-4" />
          Catalog
        </Link>
      </div>
    </div>
  );
}
