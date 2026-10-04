"use client";

import * as React from "react";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { StatCardSkeleton } from "@/components/common/stat-card";

/** Wrapper that gives every style-guide block a consistent heading rhythm. */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <header className="space-y-1 border-b border-border pb-3">
        <h2 className="font-display text-h2 font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
        {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Small mono caption used to label individual swatches and tokens. */
export function TokenLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-code text-muted-foreground">{children}</p>;
}

/* -------------------------------------------------------------------------- */

export function TypographySection() {
  const scale = [
    { token: "text-hero", sample: "Hero · clamp(2.5rem, 6vw, 4.5rem)", className: "text-hero font-display font-semibold leading-[1.08]" },
    { token: "text-h1", sample: "H1 · 2.25rem", className: "text-h1 font-display font-semibold" },
    { token: "text-h2", sample: "H2 · 1.75rem", className: "text-h2 font-display font-semibold" },
    { token: "text-h3", sample: "H3 · 1.25rem", className: "text-h3 font-display font-semibold" },
    { token: "text-body", sample: "Body · 1rem / line-height 1.6", className: "text-body text-foreground" },
    { token: "text-small", sample: "Small · 0.875rem", className: "text-small text-foreground" },
    { token: "text-caption", sample: "Caption · 0.75rem", className: "text-caption text-foreground" },
  ];

  return (
    <Section id="typography" title="Typography" description="Fraunces display · Inter body · JetBrains Mono codes">
      <div className="space-y-5 rounded-lg border border-border bg-surface p-6">
        {scale.map((row) => (
          <div key={row.token} className="space-y-1">
            <p className={row.className}>{row.sample}</p>
            <TokenLabel>{row.token}</TokenLabel>
          </div>
        ))}
        <div className="space-y-1 border-t border-border pt-5">
          <p className="font-mono text-code">LIB-2026-0042 · 978-0-13-235088-4</p>
          <TokenLabel>--font-mono</TokenLabel>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function SurfacesSection() {
  const tokens = [
    { name: "background", className: "bg-background" },
    { name: "surface", className: "bg-surface" },
    { name: "muted", className: "bg-muted" },
    { name: "primary", className: "bg-primary" },
    { name: "primary-soft", className: "bg-primary-soft" },
    { name: "accent", className: "bg-accent" },
    { name: "accent-soft", className: "bg-accent-soft" },
  ];

  const statuses = [
    { name: "success", className: "bg-success", soft: "bg-success-soft" },
    { name: "warning", className: "bg-warning", soft: "bg-warning-soft" },
    { name: "danger", className: "bg-danger", soft: "bg-danger-soft" },
    { name: "info", className: "bg-info", soft: "bg-info-soft" },
  ];

  const categories = ["forest", "terracotta", "ocean", "plum", "ochre", "slate"] as const;

  return (
    <Section id="colors" title="Colour tokens" description="Light and dark are defined once in globals.css">
      <div className="space-y-6 rounded-lg border border-border bg-surface p-6">
        <div>
          <TokenLabel>Surfaces & brand</TokenLabel>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {tokens.map((token) => (
              <div key={token.name} className="space-y-1.5">
                <div className={cn(token.className, "h-14 rounded-md border border-border")} />
                <TokenLabel>{token.name}</TokenLabel>
              </div>
            ))}
          </div>
        </div>

        <div>
          <TokenLabel>Status (+ soft tints for badges)</TokenLabel>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statuses.map((token) => (
              <div key={token.name} className="space-y-1.5">
                <div className={cn(token.className, "h-14 rounded-md border border-border")} />
                <div className={cn(token.soft, "h-6 rounded-md border border-border")} />
                <TokenLabel>{token.name}</TokenLabel>
              </div>
            ))}
          </div>
        </div>

        <div>
          <TokenLabel>Category accents</TokenLabel>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {categories.map((name) => (
              <div key={name} className="space-y-1.5">
                <div className={cn(`bg-cat-${name}`, "h-12 rounded-md border border-border")} />
                <TokenLabel>{name}</TokenLabel>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

export function FeedbackSection() {
  return (
    <Section id="feedback" title="Cards, skeletons & empty states">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Card title</CardTitle>
            <CardDescription>Cards use surface + border + shadow-soft.</CardDescription>
          </CardHeader>
          <CardContent className="text-small text-muted-foreground">Card content.</CardContent>
        </Card>

        <div className="space-y-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="rounded-lg border border-border bg-surface">
          <Skeleton className="h-11 w-full rounded-t-lg" />
          <div className="space-y-2 p-5">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>

      <Card>
        <EmptyState
          icon={BookOpen}
          title="No books match those filters"
          description="Try a broader search term, or clear the filters to see the whole catalogue."
        />
      </Card>
    </Section>
  );
}
