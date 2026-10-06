import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { ROUTES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Athenaeum",
  description: "Library Management System — cataloguing, circulation, reservations and reporting.",
};

/**
 * Interim root. Unit 20 introduces `app/(marketing)/page.tsx`, which takes
 * ownership of `/` and must delete this file in the same unit to avoid a route
 * conflict.
 *
 * The catalog link became real in Unit 09; it used to render `aria-disabled` with a
 * "coming soon" note, which is the right way to ship a placeholder and the wrong way
 * to leave one in place once the route exists.
 */
export default function RootPage() {
  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center gap-8 py-24 text-center">
      <Logo className="justify-center" />
      <div className="max-w-xl space-y-3">
        <h1 className="text-balance text-hero font-display font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          A quiet place for a loud catalogue.
        </h1>
        <p className="text-pretty text-body text-muted-foreground">
          Athenaeum is a library management system for cataloguing books, running the circulation desk,
          managing reservations and fines, and reporting on all of it.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Link href={ROUTES.catalog} className={buttonVariants({ size: "lg" })}>
          Browse the catalog
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <p className="text-caption text-muted-foreground">
          Sign in to borrow, reserve and track what you have read.
        </p>
      </div>
    </main>
  );
}
