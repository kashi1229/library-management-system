import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { CATEGORY_COLOR_CLASS, type CategoryColor } from "@/lib/constants";
import { cloudinaryUrl } from "@/lib/cloudinary-shared";

type BookCoverProps = {
  /** Cloudinary public id for the uploaded cover. */
  publicId?: string | null;
  /** Fully-formed cover URL, when one is already stored on the document. */
  url?: string | null;
  title: string;
  /** First author, shown on the generated fallback cover. */
  author?: string | null;
  /** Drives the fallback gradient and accent bar. */
  categoryColor?: CategoryColor | string | null;
  /** Rendered width in px — keeps `next/image` from guessing. */
  width?: number;
  className?: string;
  /** Accessible label; defaults to the book title. */
  alt?: string;
  sizes?: string;
  priority?: boolean;
};

/**
 * 2:3 book cover with a subtle inner border and a left-edge spine highlight
 * built from a CSS gradient. When no cover image exists we generate an elegant
 * typographic cover from the category accent colour (ui-context.md).
 */
export function BookCover({
  publicId,
  url,
  title,
  author,
  categoryColor,
  width = 320,
  className,
  alt,
  sizes = "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px",
  priority = false,
}: BookCoverProps) {
  const resolved = resolveColor(categoryColor);
  const imageUrl = url?.trim() || cloudinaryUrl(publicId, { width, height: Math.round(width * 1.5) });

  return (
    <div
      className={cn(
        "relative isolate aspect-[2/3] w-full overflow-hidden rounded-md border border-border bg-muted",
        "shadow-[inset_0_0_0_1px_var(--color-background)]",
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt ?? title}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <GeneratedCover title={title} author={author} color={resolved} compact={width <= COMPACT_COVER_WIDTH} />
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[7px] bg-linear-to-r from-foreground/25 via-foreground/8 to-transparent"
      />
    </div>
  );
}

/** Typographic stand-in used when a book has no uploaded cover. */
function GeneratedCover({
  title,
  author,
  color,
  compact,
}: {
  title: string;
  author?: string | null;
  color: (typeof CATEGORY_COLOR_CLASS)[CategoryColor];
  /**
   * Below this width the title is **not rendered at all**.
   *
   * The typographic fallback uses `p-4` and body-size type. At 56px wide that leaves about
   * 24px of content, so "Structure and Interpretation of Computer Programs" rendered as
   * "Str / and / Har" over three lines — a cover that looks broken rather than generated.
   * At 32px it left nothing at all and the text was clipped away invisibly, which is why the
   * row covers looked fine and the issue-ticket cover looked wrong: same component, one
   * size above a threshold nobody had drawn.
   *
   * A flat category tint is the honest rendering at that size, and every place a cover is
   * this small also shows the real title and author next to it.
   */
  compact: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-between",
        compact ? "p-0" : "p-4",
        color.bg,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-background/20 to-transparent"
      />
      {compact ? null : (
        <>
          <p
            className={cn(
              "line-clamp-5 font-display text-small font-semibold leading-tight tracking-[-0.01em]",
              color.on,
            )}
          >
            {title}
          </p>
          {author ? (
            <p className={cn("line-clamp-2 text-caption", color.on)}>{author}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Rendered widths at or below this drop the generated title entirely. */
const COMPACT_COVER_WIDTH = 72;

/** Fall back to `forest` so an unknown category key never produces an undefined class. */
function resolveColor(value: CategoryColor | string | null | undefined) {
  return CATEGORY_COLOR_CLASS[(value as CategoryColor) ?? "forest"] ?? CATEGORY_COLOR_CLASS.forest;
}
