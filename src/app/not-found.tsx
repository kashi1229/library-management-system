import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/** Global 404 (context/code-standards.md requires a root `not-found.tsx`). */
export default function NotFound() {
  return (
    <main className="container-page flex flex-1 flex-col items-center justify-center gap-8 py-24 text-center">
      <Logo markOnly className="justify-center" />
      <div className="max-w-md space-y-3">
        <p className="font-mono text-code text-accent-ink">404</p>
        <h1 className="text-balance text-hero font-display font-semibold leading-[1.08] tracking-[-0.02em] text-foreground">
          This shelf is empty.
        </h1>
        <p className="text-pretty text-body text-muted-foreground">
          The page you were looking for has been moved, archived, or never catalogued.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }))}>
        <ArrowLeft className="size-4" />
        Back to the reading room
      </Link>
      <p className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
        <BookOpen className="size-3.5" />
        Athenaeum Library Management System
      </p>
    </main>
  );
}
