import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Athenaeum",
  description: "Library Management System — cataloguing, circulation, reservations and reporting.",
};

/**
 * Unit 01 placeholder. The real marketing landing page is built in Unit 20
 * (`(marketing)/` route group), which will own `/` from that point on.
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
        <Link
          href="/catalog"
          className={cn(buttonVariants({ size: "lg" }), "pointer-events-none opacity-60")}
          aria-disabled="true"
          tabIndex={-1}
        >
          Browse the catalog
          <ArrowRight className="size-4" />
        </Link>
        <p className="text-caption text-muted-foreground">
          The catalog opens in Unit 09. The design system is ready now.
        </p>
      </div>
    </main>
  );
}
