"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Link from "next/link";
import { BookOpen, Star } from "lucide-react";
import { BookCover } from "@/components/common/book-cover";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { drifts } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-variants";
import { cn } from "@/lib/utils";
import type { CatalogBook } from "@/types";

type BookPose = {
  rotateZ: number;
  rotateY: number;
  lift: number;
  scale: number;
  delay: number;
};

const POSES: BookPose[] = [
  { rotateZ: -3.5, rotateY: 5, lift: 8, scale: 0.98, delay: 0 },
  { rotateZ: 3, rotateY: -6, lift: -10, scale: 1.02, delay: 0.6 },
  { rotateZ: -1.5, rotateY: 4, lift: 12, scale: 0.99, delay: 1.2 },
  { rotateZ: 4.5, rotateY: -4, lift: -4, scale: 1.01, delay: 1.8 },
  { rotateZ: -2.5, rotateY: 6, lift: 14, scale: 0.97, delay: 2.4 },
  { rotateZ: 2, rotateY: -3, lift: -8, scale: 1.0, delay: 3.0 },
];

/**
 * 3D Physical Book Cluster for the Hero Section.
 *
 * Engineered with:
 * - Real catalog books from public stats (no placeholders).
 * - Interactive pointer parallax & subtle 3D tilt.
 * - Smooth sine-wave float physics using `motion/react`.
 * - Tactile hover card with category tint, availability pill, and star ratings.
 * - Direct keyboard accessible links to individual book details.
 * - Graceful fallback and disabled 3D transforms under `prefers-reduced-motion`.
 */
export function CoverStack({
  books,
  className,
}: {
  books: CatalogBook[];
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Mouse tilt tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { stiffness: 150, damping: 20 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  const containerRotateX = useTransform(smoothY, [-0.5, 0.5], [6, -6]);
  const containerRotateY = useTransform(smoothX, [-0.5, 0.5], [-8, 8]);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = (event.clientX - rect.left) / rect.width - 0.5;
    const yPct = (event.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(xPct);
    mouseY.set(yPct);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const shown = books.slice(0, 6);
  if (shown.length === 0) return null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("relative isolate select-none", className)}
      style={{ perspective: "1400px" }}
    >
      {/* Warm accent halo under the book array */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-full bg-[radial-gradient(ellipse_at_center,var(--color-accent-soft),transparent_70%)] opacity-70 blur-3xl dark:opacity-35"
      />

      {/* Floating 3D grid container */}
      <motion.div
        className="relative grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 [transform-style:preserve-3d]"
        style={{
          rotateX: reduced ? 0 : containerRotateX,
          rotateY: reduced ? 0 : containerRotateY,
        }}
      >
        {shown.map((book, index) => {
          const pose = POSES[index % POSES.length];

          return (
            <motion.div
              key={book._id}
              className={cn(
                "group relative min-w-0 [transform-style:preserve-3d]",
                // Keep 4 on small mobile, 6 on tablet and desktop
                index >= 4 && "hidden sm:block",
              )}
              initial={false}
              animate={
                reduced
                  ? undefined
                  : {
                      y: [pose.lift, pose.lift - 12, pose.lift],
                      rotateZ: [pose.rotateZ, pose.rotateZ + 1, pose.rotateZ],
                    }
              }
              transition={
                reduced
                  ? undefined
                  : {
                      ...drifts.cover,
                      delay: pose.delay,
                    }
              }
            >
              <Link
                href={`/catalog/${book.slug}`}
                aria-label={`View details for ${book.title} by ${book.authors.join(", ")}`}
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
              >
                {/* Physical book sleeve */}
                <div
                  className="relative rounded-md transition-all duration-300 ease-out group-hover:scale-[1.04] group-hover:shadow-lift"
                  style={{
                    transform: reduced
                      ? undefined
                      : `rotateY(${pose.rotateY}deg)`,
                    boxShadow:
                      "0 12px 28px -8px rgba(28, 25, 23, 0.2), 0 4px 12px -2px rgba(28, 25, 23, 0.12)",
                  }}
                >
                  <BookCover
                    publicId={book.cover?.publicId}
                    url={book.cover?.url}
                    title={book.title}
                    author={book.authors[0]}
                    categoryColor={book.category.color}
                    width={220}
                    sizes="(max-width: 640px) 44vw, (max-width: 1024px) 26vw, 180px"
                    className="rounded-md border border-border/80"
                  />

                  {/* Left Spine 3D Lighting Highlight */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-2 rounded-l-md bg-linear-to-r from-white/30 via-white/10 to-transparent dark:from-white/15 dark:via-white/5"
                  />

                  {/* Availability badge badge overlay on hover/focus */}
                  <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 rounded bg-background/90 px-2 py-1 backdrop-blur-md opacity-90 transition-opacity group-hover:opacity-100">
                    <span className="truncate text-[11px] font-semibold text-foreground">
                      {book.category.name}
                    </span>
                    <AvailabilityBadge
                      available={book.effectiveAvailable}
                      total={book.totalCopies}
                      size="sm"
                    />
                  </div>
                </div>

                {/* Micro Meta below the cover */}
                <div className="mt-2 text-center">
                  <p className="line-clamp-1 text-caption font-medium text-foreground transition-colors group-hover:text-accent-ink">
                    {book.title}
                  </p>
                  <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="line-clamp-1">{book.authors[0]}</span>
                    {book.ratingCount > 0 ? (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5 text-accent-ink font-mono">
                          <Star className="size-2.5 fill-accent text-accent" />
                          {book.ratingAvg.toFixed(1)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Direct link hint */}
      <div className="mt-6 flex items-center justify-center gap-2 text-caption text-muted-foreground">
        <BookOpen className="size-3.5 text-accent" />
        <span>Click any book to inspect its shelf location and loan queue</span>
      </div>
    </div>
  );
}