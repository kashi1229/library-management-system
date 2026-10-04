import * as React from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/common/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BookSpines } from "@/components/features/auth/book-spines";

/**
 * Two-panel auth shell (ui-context.md §Layout Patterns).
 *
 * ≥1024px: left form on `background`, right decorative panel on `primary`.
 * Below that the panel is hidden and the form centres with a compact logo.
 */
export function AuthLayout({
  children,
  title,
  subtitle,
  footer,
  className,
}: {
  children: React.ReactNode;
  /** Serif headline above the form. */
  title: string;
  subtitle?: React.ReactNode;
  /** Links or hints rendered under the form's submit action. */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      {/* ------------------------------- Form panel ------------------------------ */}
      <main className={cn("flex flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-12", className)}>
        <header className="flex items-center justify-between gap-4">
          <Logo markOnly className="lg:hidden" />
          <div className="hidden lg:block" />
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-2">
              <h1 className="text-balance font-display text-h1 font-semibold tracking-[-0.02em] text-foreground">
                {title}
              </h1>
              {subtitle ? (
                <p className="text-pretty text-body text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </div>
        </div>

        {footer ? <footer className="text-small text-muted-foreground">{footer}</footer> : null}
      </main>

      {/* ---------------------------- Decorative panel --------------------------- */}
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        {/* Soft paper grain so the flat forest panel does not read as dead space. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-primary-foreground) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-primary-foreground/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full bg-primary-foreground/5 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-foreground/12 text-primary-foreground">
            <LibraryGlyph />
          </span>
          <span className="font-display text-h3 leading-none font-semibold tracking-[-0.02em] text-primary-foreground">
            Athenaeum
          </span>
        </div>

        <div className="relative space-y-10">
          <blockquote className="max-w-md">
            <p className="text-balance font-display text-3xl leading-[1.15] font-medium tracking-[-0.02em] text-primary-foreground xl:text-4xl">
              “A library is a quiet kind of magic.”
            </p>
            <footer className="mt-4 text-small text-primary-foreground/65">
              Every shelf here is a record of someone&rsquo;s curiosity.
            </footer>
          </blockquote>

          <BookSpines />
        </div>

        <p className="relative text-caption text-primary-foreground/50">
          Cataloguing · Circulation · Reservations · Reports
        </p>
      </aside>
    </div>
  );
}

function LibraryGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px]"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}
