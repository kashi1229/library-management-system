"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, Star } from "lucide-react";
import { BookCover } from "@/components/common/book-cover";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { Reveal } from "@/components/features/marketing/reveal";
import { SectionEyebrow } from "@/components/features/marketing/section-eyebrow";
import { ROUTES } from "@/lib/constants";
import type { CatalogBook } from "@/types";

const PAGE_STEP = 0.8;

/**
 * Editorial Reading Room Shelf: New Arrivals Carousel.
 *
 * Engineered with:
 * - Native momentum scroll snap + pointer drag handling.
 * - Dynamic edge fade gradient masks indicating overflow.
 * - Arrow navigation controls with keyboard shortcuts (ArrowLeft / ArrowRight).
 * - Full metadata cards (Cover, availability badge, authors, category, year, rating).
 * - Suppression of image drag conflicts and false click triggers.
 */
export function NewArrivals({ books }: { books: CatalogBook[] }) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);
  const [edges, setEdges] = React.useState({ start: true, end: false });

  const readEdges = React.useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    if (track.clientWidth === 0 || track.scrollWidth === 0) return;

    setEdges({
      start: track.scrollLeft <= 1,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 1,
    });
  }, []);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    readEdges();
    const observer = new ResizeObserver(readEdges);
    observer.observe(track);

    track.addEventListener("scroll", readEdges, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", readEdges);
    };
  }, [readEdges, books.length]);

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth * PAGE_STEP,
      behavior: "smooth",
    });
  };

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = {
      startX: event.clientX,
      startScroll: track.scrollLeft,
      moved: false,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track) return;

    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 3) drag.moved = true;
    if (!drag.moved) return;

    track.scrollLeft = drag.startScroll - delta;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const track = trackRef.current;
    if (track?.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }
  }

  function onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!dragRef.current?.moved) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { ...dragRef.current, moved: false };
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollBy(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollBy(1);
    }
  }

  if (books.length === 0) return null;

  const fade = `linear-gradient(to right, transparent 0, black ${
    edges.start ? "2rem" : "0px"
  }, black calc(100% - ${edges.end ? "2rem" : "0px"}), transparent 100%)`;

  return (
    <section
      aria-labelledby="new-arrivals-heading"
      className="relative border-y border-border bg-muted/40 py-16 md:py-24"
    >
      <div className="container-page space-y-10">
        {/* Section Header */}
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <SectionEyebrow>Recent Acquisitions</SectionEyebrow>
            <h2
              id="new-arrivals-heading"
              className="text-balance font-display text-h1 font-semibold tracking-[-0.02em] text-foreground"
            >
              Fresh on the reading shelves
            </h2>
            <p className="text-pretty text-body text-muted-foreground">
              Explore the latest monographs, course reserves, and research additions
              catalogued by our library staff.
            </p>
          </div>

          {/* Carousel Arrows */}
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface p-1 shadow-soft">
            <button
              type="button"
              aria-label="Scroll new arrivals shelf left"
              disabled={edges.start}
              onClick={() => scrollBy(-1)}
              className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
            >
              <ChevronLeft aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </button>
            <span className="h-4 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              aria-label="Scroll new arrivals shelf right"
              disabled={edges.end}
              onClick={() => scrollBy(1)}
              className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
            >
              <ChevronRight aria-hidden="true" strokeWidth={1.75} className="size-5" />
            </button>
          </div>
        </Reveal>

        {/* Scroll Port */}
        <div className="relative -mx-4 sm:-mx-6">
          <div
            ref={trackRef}
            role="region"
            aria-label="New arrivals book shelf, horizontally scrollable"
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClickCapture={onClickCapture}
            onDragStart={(event) => event.preventDefault()}
            className="scroll-p-4 overflow-x-auto overscroll-x-contain px-4 pb-4 sm:scroll-p-6 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            style={{
              scrollSnapType: "x proximity",
              scrollbarWidth: "none",
              maskImage: fade,
              WebkitMaskImage: fade,
            }}
          >
            <ul className="flex w-max cursor-grab select-none gap-5 active:cursor-grabbing">
              {books.map((book) => (
                <li
                  key={book._id}
                  className="w-[190px] shrink-0 sm:w-[220px]"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <ShelfCard book={book} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer info & Catalog Route */}
        <Reveal className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-5">
          <div className="flex items-center gap-2 text-caption text-muted-foreground">
            <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
            <span>
              Updated continuously as librarians complete physical cataloguing
            </span>
          </div>

          <Link
            href={`${ROUTES.catalog}?sort=newest`}
            className="group inline-flex min-h-11 items-center gap-1.5 rounded-md text-small font-medium text-accent-ink underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
          >
            <span>View all recent acquisitions in catalog</span>
            <ArrowRight
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
            />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function ShelfCard({ book }: { book: CatalogBook }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-surface shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift motion-reduce:hover:translate-y-0">
      <Link
        href={`/catalog/${book.slug}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
      >
        <span className="sr-only">{book.title}</span>

        {/* Cover with top gradient and availability pill */}
        <div className="relative overflow-hidden bg-muted">
          <BookCover
            publicId={book.cover?.publicId}
            url={book.cover?.url}
            title={book.title}
            author={book.authors[0]}
            categoryColor={book.category.color}
            width={340}
            sizes="(max-width: 640px) 45vw, 220px"
            className="rounded-none border-b border-border/80 transition-transform duration-300 group-hover:scale-[1.02]"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between items-end bg-linear-to-t from-black/75 via-black/35 to-transparent p-2.5">
            <span className="inline-flex rounded-full bg-background/95 px-2 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur-md shadow-sm">
              {book.category.name}
            </span>
            <AvailabilityBadge
              available={book.effectiveAvailable}
              total={book.totalCopies}
              size="sm"
            />
          </div>
        </div>

        {/* Card Details */}
        <div className="flex flex-1 flex-col justify-between p-3.5">
          <div>
            <h3 className="line-clamp-2 font-display text-small font-semibold leading-snug text-pretty text-foreground transition-colors group-hover:text-accent-ink">
              {book.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-caption text-muted-foreground">
              {book.authors.join(", ")}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground font-mono">
            <span>{book.publishedYear ? `Pub. ${book.publishedYear}` : "Circulating"}</span>
            {book.ratingCount > 0 ? (
              <span className="flex items-center gap-0.5 text-accent-ink font-medium">
                <Star className="size-3 fill-accent text-accent" aria-hidden="true" />
                {book.ratingAvg.toFixed(1)}
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      {/* Focus Ring Overlay */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl transition-shadow group-focus-within:ring-2 group-focus-within:ring-ring"
      />
    </article>
  );
}