import * as React from "react";
import { cn, initials } from "@/lib/utils";

type LogoProps = {
  /** Renders only the glyph. Use in collapsed rails and tight mobile headers. */
  markOnly?: boolean;
  /** Overrides the wordmark text (Settings stores the live library name). */
  name?: string;
  className?: string;
};

/**
 * Brand mark: a Lucide `Library` glyph in the forest primary, paired with a
 * serif wordmark (ui-context.md §Navigation). Pure presentational, no state.
 */
export function Logo({ markOnly = false, name = "Athenaeum", className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
      >
        <LibraryGlyph />
      </span>
      {!markOnly && (
        <span className="font-display text-h3 leading-none font-semibold tracking-[-0.02em] text-foreground">
          {name}
        </span>
      )}
    </span>
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

/**
 * Avatar with an initials fallback. Kept local to `common` so the app never
 * depends on a remote image just to show a person.
 */
export function InitialAvatar({
  name,
  imageUrl,
  size = "md",
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimension = { sm: "size-8 text-caption", md: "size-10 text-small", lg: "size-14 text-h3" }[size];

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar src is a runtime Cloudinary URL
      <img
        src={imageUrl}
        alt=""
        className={cn("shrink-0 rounded-full border border-border object-cover", dimension, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-border bg-accent-soft font-display font-semibold text-accent-ink",
        dimension,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
