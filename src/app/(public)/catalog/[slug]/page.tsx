import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getCatalogBook, listRelatedBooks } from "@/lib/services/books";
import { getSession } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/constants";
import { BookCover } from "@/components/common/book-cover";
import { CategoryIconTile } from "@/components/common/category-icon-tile";
import { AvailabilityBadge } from "@/components/features/catalog/availability-badge";
import { StarRating } from "@/components/features/catalog/star-rating";
import { BookActions } from "@/components/features/catalog/book-actions";
import { ReadMore } from "@/components/features/catalog/read-more";
import { ROUTES } from "@/lib/constants";
import { Types as MongooseTypes } from "mongoose";
import { cloudinaryUrl } from "@/lib/cloudinary-shared";
import type { CatalogBook } from "@/types";

type Params = { params: Promise<{ slug: string }> };

/** Truncate for the meta description without cutting mid-word. */
function excerpt(text: string | null, max = 155): string {
  if (!text) return "Browse this book in the Athenaeum library catalog.";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;

  try {
    const book = await getCatalogBook(slug);

    return {
      title: book.title,
      description: excerpt(book.description),
      openGraph: {
        title: book.title,
        description: excerpt(book.description),
        type: "book",
        images: book.cover
          ? [cloudinaryUrl(book.cover.publicId, { width: 1200, height: 630, gravity: "auto", crop: "fill" })]
          : undefined,
      },
    };
  } catch {
    return { title: "Book not found" };
  }
}

/**
 * Book detail page (F5), server-rendered.
 *
 * **Archived books 404 for visitors.** The catalog must not be able to enumerate
 * withdrawn stock, and a 404 is the honest answer for someone who cannot have it —
 * a "this book is no longer available" page would confirm it exists.
 */
export default async function BookDetailPage({ params }: Params) {
  const { slug } = await params;
  const session = await getSession().catch(() => null);
  const isStaff = session ? isStaffRole(session.role) : false;

  let book;
  try {
    book = await getCatalogBook(
      slug,
      session ? new MongooseTypes.ObjectId(session.sub) : undefined,
    );
  } catch {
    notFound();
  }

  if (book.status === "archived" && !isStaff) notFound();

  const related = await listRelatedBooks(slug, 6).catch(() => [] as CatalogBook[]);

  const meta = [
    ["ISBN", book.isbn],
    ["Publisher", book.publisher],
    ["Published", book.publishedYear ? String(book.publishedYear) : null],
    ["Edition", book.edition],
    ["Language", book.language],
    ["Pages", book.pageCount ? String(book.pageCount) : null],
    ["Shelf", book.shelfLocation],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="container-page pt-6 pb-16">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex flex-wrap items-center gap-1 text-caption text-muted-foreground">
          <li>
            <Link href={ROUTES.catalog} className="hover:text-foreground hover:underline">
              Catalog
            </Link>
          </li>
          <ChevronRight className="size-3" aria-hidden="true" />
          <li>
            <Link
              href={`${ROUTES.catalog}?category=${book.category._id}`}
              className="hover:text-foreground hover:underline"
            >
              {book.category.name}
            </Link>
          </li>
          <ChevronRight className="size-3" aria-hidden="true" />
          <li className="truncate font-medium text-foreground">{book.title}</li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10 lg:gap-14">
        <div className="md:sticky md:top-24 md:self-start">
          <BookCover
            publicId={book.cover?.publicId}
            url={book.cover?.url}
            title={book.title}
            author={book.authors[0]}
            categoryColor={book.category.color}
            width={600}
            sizes="(max-width: 768px) 45vw, 240px"
            priority
            className="mx-auto w-40 shadow-lift sm:w-56 md:mx-0 md:w-full"
          />
        </div>

        <div className="min-w-0 space-y-8">
          <header className="space-y-3">
            <Link
              href={`${ROUTES.catalog}?category=${book.category._id}`}
              className="inline-flex items-center gap-2 rounded-full text-caption text-muted-foreground hover:text-foreground"
            >
              <CategoryIconTile
                icon={book.category.icon}
                color={book.category.color}
                className="size-6 shrink-0 rounded-[4px] [&_svg]:size-3.5"
              />
              {book.category.name}
            </Link>

            <h1 className="text-h1 font-display font-semibold text-pretty text-foreground">
              {book.title}
            </h1>

            <p className="text-body text-pretty text-muted-foreground">
              by <span className="text-foreground">{book.authors.join(", ")}</span>
            </p>

            <StarRating value={book.ratingAvg} count={book.ratingCount} />
          </header>

          <div className="rounded-lg border border-border bg-surface p-5 shadow-soft">
            <AvailabilityBadge
              available={book.effectiveAvailable}
              total={book.totalCopies}
              queueLength={book.queueLength}
              className="mb-4"
            />
            <BookActions book={book} signedIn={Boolean(session)} />
          </div>

          {book.description ? (
            <section aria-labelledby="about" className="space-y-2">
              <h2 id="about" className="text-h3 font-display font-semibold text-foreground">
                About this book
              </h2>
              <ReadMore text={book.description} />
            </section>
          ) : null}

          <section aria-labelledby="details" className="space-y-3">
            <h2 id="details" className="text-h3 font-display font-semibold text-foreground">
              Details
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {meta.map(([label, value]) => (
                <div key={label} className="flex min-w-0 items-baseline gap-3 border-b border-border pb-2">
                  <dt className="w-24 shrink-0 text-small text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 flex-1 text-small break-words text-foreground">
                    {label === "ISBN" || label === "Shelf" ? (
                      <span className="font-mono text-code">{value}</span>
                    ) : (
                      value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {book.tags.length > 0 ? (
            <section aria-labelledby="tags" className="space-y-3">
              <h2 id="tags" className="text-h3 font-display font-semibold text-foreground">
                Subjects
              </h2>
              <ul className="flex flex-wrap gap-2">
                {book.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`${ROUTES.catalog}?q=${encodeURIComponent(tag)}`}
                      className="inline-flex min-h-8 items-center rounded-full bg-muted px-3 text-caption text-muted-foreground transition-colors hover:bg-accent-soft hover:text-accent-ink"
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section aria-labelledby="related" className="space-y-4">
              <h2 id="related" className="text-h3 font-display font-semibold text-foreground">
                More in {book.category.name}
              </h2>
              <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {related.map((item) => (
                  <li key={item._id} className="min-w-0">
                    <Link
                      href={`${ROUTES.catalog}/${item.slug}`}
                      className="group block focus-visible:outline-none"
                    >
                      <BookCover
                        publicId={item.cover?.publicId}
                        url={item.cover?.url}
                        title={item.title}
                        author={item.authors[0]}
                        categoryColor={item.category.color}
                        width={200}
                        sizes="160px"
                        className="w-full transition-transform duration-200 group-hover:-translate-y-0.5"
                      />
                      <p className="mt-2 line-clamp-2 text-caption text-pretty text-muted-foreground group-hover:text-foreground">
                        {item.title}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}