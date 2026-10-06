import "server-only";
import { Types } from "mongoose";
import { AppError } from "@/lib/api";
import { Book, Category, Loan, Reservation, Wishlist } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { destroyAsset } from "@/lib/cloudinary";
import { slugify } from "@/lib/validators/category";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
  type CategoryColor,
} from "@/lib/constants";
import type { CreateBookInput, ListBooksQuery, UpdateBookInput } from "@/lib/validators/book";
import type { Actor, BookDoc, CloudinaryImage } from "@/types";

/**
 * Book service — all business logic for F4.
 *
 * Every rule from `architecture.md` §Business Rules that touches a book lives
 * here, never in a route handler (invariant 1), and every mutation is audited
 * (invariant 11).
 */

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Wire shapes are declared once, in `types/index.ts`, because the service produces
 * them and `api-client` consumes them. Two copies of the same interface drift:
 * the service kept `isbn?: string | null` (mirroring the Mongoose field) while the
 * client declared it required, which made passing a service result to a client
 * component a type error with no obvious cause.
 */
export type { BookDetail, BookSummary } from "@/types";
import type {
  BookDetail,
  BookSummary,
  CatalogBookDetail,
  CatalogFacets,
  UserBookState,
} from "@/types";

/** The list item is the detail minus the two derived numbers. */
export type BookListItem = BookSummary;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Escape a user string before interpolating it into a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Serialise a lean book for the API boundary: ObjectId and Date become strings,
 * as `code-standards.md` requires.
 *
 * Fields are picked **explicitly** rather than spread. A spread silently forwards
 * whatever Mongoose adds later — `addedBy` and `__v` are not in the wire contract,
 * and `__v` leaking a version key to the browser is the kind of thing nobody
 * notices until an audit of the API response. Listing them also means a schema
 * change fails to compile here instead of quietly widening the public shape.
 */
function toApi(
  book: Record<string, unknown>,
  category: BookSummary["category"] | null,
): BookListItem {
  const b = book as Partial<BookDoc> & { _id: unknown; createdAt: Date; updatedAt: Date };

  return {
    _id: String(b._id),
    title: String(b.title ?? ""),
    slug: String(b.slug ?? ""),
    authors: b.authors ?? [],
    isbn: b.isbn ?? null,
    publisher: b.publisher ?? null,
    edition: b.edition ?? null,
    publishedYear: b.publishedYear ?? null,
    language: String(b.language ?? "English"),
    // A book always has a category (the schema requires it), so the placeholder is
    // only reachable if a lookup was skipped. It is shaped like a real summary so
    // the UI can render it without a null check on every field.
    category: category ?? EMPTY_CATEGORY,
    tags: b.tags ?? [],
    description: b.description ?? null,
    pageCount: b.pageCount ?? null,
    cover: b.cover ?? null,
    shelfLocation: b.shelfLocation ?? null,
    totalCopies: b.totalCopies ?? 0,
    availableCopies: b.availableCopies ?? 0,
    status: b.status ?? "active",
    ratingAvg: b.ratingAvg ?? 0,
    ratingCount: b.ratingCount ?? 0,
    borrowCount: b.borrowCount ?? 0,
    createdAt: new Date(b.createdAt).toISOString(),
    updatedAt: new Date(b.updatedAt).toISOString(),
  };
}

const EMPTY_CATEGORY: BookSummary["category"] = {
  _id: "",
  name: "",
  slug: "",
  icon: "BookOpen",
  color: DEFAULT_CATEGORY_COLOR,
};

/**
 * Resolve a book by ObjectId or slug.
 *
 * The public catalog links by slug (stable, readable) while staff actions use the
 * id, so both forms must resolve. A 24-hex string is tried as an id first, then
 * as a slug, so a book whose slug happens to look like an id still resolves.
 */
export async function findBook(idOrSlug: string) {
  if (!Types.ObjectId.isValid(idOrSlug)) {
    const bySlug = await Book.findOne({ slug: idOrSlug });
    if (!bySlug) throw AppError.notFound("That book could not be found.");
    return bySlug;
  }

  const byId = await Book.findById(idOrSlug);
  if (byId) return byId;

  const bySlug = await Book.findOne({ slug: idOrSlug });
  if (!bySlug) throw AppError.notFound("That book could not be found.");
  return bySlug;
}

/** Category summaries for a page of books, in one query rather than N. */
async function categoryMap(
  ids: Types.ObjectId[],
): Promise<Map<string, BookSummary["category"]>> {
  const rows = (await Category.find({ _id: { $in: ids } })
    .select("name slug icon color")
    .lean()) as unknown as Array<Record<string, unknown>>;

  const map = new Map<string, BookSummary["category"]>();
  for (const row of rows) {
    map.set(String(row._id), {
      _id: String(row._id),
      name: String(row.name),
      slug: String(row.slug),
      icon: String(row.icon ?? DEFAULT_CATEGORY_ICON),
      // Guarded rather than cast: a colour that is somehow not in `CATEGORY_COLORS`
      // would produce an undefined Tailwind class, and an invisible chip is a much
      // worse failure than a wrong-but-visible one.
      color: isCategoryColor(row.color) ? row.color : DEFAULT_CATEGORY_COLOR,
    });
  }
  return map;
}

/** Narrow an untrusted value to a known category colour key. */
function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === "string" && (CATEGORY_COLORS as readonly string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Translate the validated query into a Mongo filter and sort.
 *
 * Every sort ends in `_id`, which looks redundant but is **required**. Books
 * created together share a `createdAt` down to the millisecond (a bulk import, a
 * seed script, a batch of fixtures), so a sort on `createdAt` alone leaves the
 * tie order up to Mongo and it is not stable between queries: page 1 and page 2
 * of the same filter could both return "QA Filler 12" and skip another row
 * entirely. A trailing unique key makes the ordering total, so a row appears
 * exactly once across all pages and "Next" cannot skip a book.
 */
function buildQuery(query: ListBooksQuery) {
  const filter: Record<string, unknown> = {};

  if (query.status && query.status !== "all") filter.status = query.status;
  if (query.category) filter.category = new Types.ObjectId(query.category);
  if (query.language) filter.language = query.language;

  if (query.yearFrom !== undefined || query.yearTo !== undefined) {
    // Only books that actually carry a year, so a book with no publication date
    // cannot appear in a "1970–1980" search just because its field is null.
    const bounds: Record<string, number> = {};
    if (query.yearFrom !== undefined) bounds.$gte = query.yearFrom;
    if (query.yearTo !== undefined) bounds.$lte = query.yearTo;
    filter.publishedYear = bounds;
  }

  if (query.q) {
    // Regex rather than `$text`: the staff table needs *partial* matches as the
    // user types ("dun" -> Dune), and `$text` only matches whole words. The
    // string is length-capped and escaped, and every value is anchored with `i`.
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ title: rx }, { authors: rx }, { isbn: rx }, { tags: rx }];
  }

  const sorts: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    title: { title: 1, _id: 1 },
    authors: { authors: 1, title: 1, _id: 1 },
    popular: { borrowCount: -1, title: 1, _id: 1 },
    rating: { ratingAvg: -1, ratingCount: -1, title: 1, _id: 1 },
  };

  return { filter, sort: sorts[query.sort] ?? sorts.newest };
}

/**
 * How many copies are promised to **ready** reservations, per book.
 *
 * Rule 6: a `ready` reservation consumes one copy from public availability, because
 * it is being held for a named member until `reservationHoldHours` expires. Showing
 * `availableCopies` in the catalog would therefore promise a book that cannot be
 * collected, which is the single most trust-destroying thing a library catalog can
 * do.
 *
 * Implemented for real rather than stubbed: the reservation collection already
 * exists, the query is one round trip, and returning zeros would mean Unit 14 had
 * to remember to come back and fix a number the catalog already displays.
 *
 * `waiting` reservations are deliberately **not** counted — they hold no copy yet.
 */
export async function getReadyHoldCounts(
  bookIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (bookIds.length === 0) return counts;

  const rows = await Reservation.aggregate<{ _id: Types.ObjectId; holds: number }>([
    { $match: { book: { $in: bookIds }, status: "ready" } },
    { $group: { _id: "$book", holds: { $sum: 1 } } },
  ]);

  for (const row of rows) counts.set(row._id.toString(), row.holds);
  return counts;
}

/**
 * Attach `effectiveAvailable` to a page of books.
 *
 * Clamped at zero and never above `totalCopies`, because a hand-edited count should
 * render "None available" rather than a negative or impossible number.
 */
async function withAvailability(
  items: BookListItem[],
): Promise<Array<BookListItem & { effectiveAvailable: number }>> {
  const holds = await getReadyHoldCounts(
    items.map((book) => new Types.ObjectId(book._id)),
  );

  return items.map((book) => ({
    ...book,
    effectiveAvailable: Math.min(
      book.totalCopies,
      Math.max(0, book.availableCopies - (holds.get(book._id) ?? 0)),
    ),
  }));
}

/**
 * List books, paginated.
 *
 * `status` defaults to `active` for the public catalog and `all` for the staff
 * table (the two call sites pass different defaults).
 */
export async function listBooks(query: ListBooksQuery): Promise<{
  items: BookListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { filter, sort } = buildQuery(query);
  const page = Math.max(1, query.page);
  const limit = Math.min(100, Math.max(1, query.limit));

  /*
   * `availability: "available"` is filtered in memory rather than in the query.
   *
   * The predicate is `availableCopies - readyHolds > 0`, and `readyHolds` lives in
   * a different collection — a `$lookup` inside `find()` cannot be followed by the
   * `skip`/`limit` Mongo needs to paginate correctly. Filtering after pagination
   * would make the result count a lie and let "Next" show an empty page, so the
   * query is widened to the whole matching set, filtered, and *then* sliced. That
   * is the honest cost of a cross-collection predicate on an unbounded filter; it
   * is bounded by the `limit` the catalog actually requests.
   */
  if (query.availability === "available") {
    const all = await Book.find(filter).sort(sort).lean();
    const serialised = await serialiseAll(all);
    const available = serialised.filter((book) => book.effectiveAvailable > 0);
    const start = (page - 1) * limit;

    return {
      items: available.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: available.length,
        totalPages: limit > 0 ? Math.ceil(available.length / limit) : 0,
      },
    };
  }

  const [total, docs] = await Promise.all([
    Book.countDocuments(filter),
    Book.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const categories = await categoryMap([
    ...new Set(docs.map((doc) => doc.category as Types.ObjectId)),
  ]);

  const items = docs.map((doc) =>
    toApi(doc as unknown as Record<string, unknown>, categories.get(String(doc.category)) ?? null),
  );

  return {
    items,
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

/** Serialise a whole result set in one go, with `effectiveAvailable` attached. */
async function serialiseAll(
  docs: Array<Record<string, unknown>>,
): Promise<Array<BookListItem & { effectiveAvailable: number }>> {
  const categories = await categoryMap([
    ...new Set(docs.map((doc) => doc.category as Types.ObjectId)),
  ]);

  const items = docs.map((doc) =>
    toApi(doc, categories.get(String(doc.category)) ?? null),
  );

  return withAvailability(items);
}

/** One book with the derived numbers the staff UI shows. */
export async function getBook(idOrSlug: string): Promise<BookDetail> {
  const book = await findBook(idOrSlug);
  const lean = book.toObject() as unknown as Record<string, unknown>;

  // `onLoan` is derived from the copy counts (invariant 4: derived, never stored),
  // so no loan query is needed here. The reservation count tells staff whether
  // deleting this book would be blocked.
  const [categories, waiting] = await Promise.all([
    categoryMap([book.category as Types.ObjectId]),
    Reservation.countDocuments({
      book: book._id,
      status: { $in: ["waiting", "ready"] },
    }),
  ]);

  const total = book.totalCopies;
  const available = book.availableCopies;

  return {
    ...toApi(lean, categories.get(String(book.category)) ?? null),
    onLoan: Math.max(0, total - available),
    waitingReservations: waiting,
  };
}

/**
 * Public catalog detail (F5).
 *
 * Adds the three numbers a reader cannot derive from the stored copy counts:
 * `effectiveAvailable` (a copy held for someone else is not available to you),
 * `queueLength` (how many people are ahead of you), and `userState` (what *this*
 * signed-in member has in flight).
 *
 * `userState` is computed from the session user id only — never from anything the
 * client sent (invariant 3) — and `requireSession()` has already run in the route,
 * so an anonymous caller simply gets the neutral `ANONYMOUS_STATE`.
 */
export async function getCatalogBook(
  idOrSlug: string,
  userId?: Types.ObjectId,
): Promise<CatalogBookDetail> {
  const book = await findBook(idOrSlug);
  const lean = book.toObject() as unknown as Record<string, unknown>;

  const [categories, reservations, wishlisted, activeLoan] = await Promise.all([
    categoryMap([book.category as Types.ObjectId]),
    Reservation.find({ book: book._id, status: { $in: ["waiting", "ready"] } })
      .select("member status")
      .lean<Array<{ member: Types.ObjectId; status: string }>>(),
    userId
      ? Wishlist.exists({ member: userId, book: book._id })
      : Promise.resolve(false),
    userId ? Loan.exists({ book: book._id, member: userId, status: "active" }) : Promise.resolve(false),
  ]);

  const mine = userId ? reservations.find((r) => String(r.member) === String(userId)) : undefined;
  const summary = toApi(lean, categories.get(String(book.category)) ?? null);
  const holds = await getReadyHoldCounts([book._id as Types.ObjectId]);

  return {
    ...summary,
    effectiveAvailable: Math.min(
      summary.totalCopies,
      Math.max(0, summary.availableCopies - (holds.get(summary._id) ?? 0)),
    ),
    // Everyone in the queue, not "everyone except you". A reader needs to know how
    // long the wait is, and the hold they are already in counts as position one.
    queueLength: reservations.length,
    userState: {
      wishlisted: Boolean(wishlisted),
      activeLoan: Boolean(activeLoan),
      reservation: (mine?.status as UserBookState["reservation"]) ?? null,
    },
  };
}

/** What an anonymous caller gets. Frozen so it cannot be mutated by a consumer. */
export const ANONYMOUS_USER_BOOK_STATE: UserBookState = Object.freeze({
  wishlisted: false,
  activeLoan: false,
  reservation: null,
});

/**
 * Other books in the same category (F5).
 *
 * Ranked rather than merely ordered by date, because "more in this category" is
 * only useful if the suggestions are related: most-borrowed first, then
 * highest-rated, then title for a stable tie-break. The book itself is excluded and
 * the result is hard-capped by `max`.
 */
export async function listRelatedBooks(
  idOrSlug: string,
  max = 6,
): Promise<Array<BookListItem & { effectiveAvailable: number }>> {
  const book = await findBook(idOrSlug);

  const docs = await Book.find({
    status: "active",
    category: book.category,
    _id: { $ne: book._id },
  })
    .sort({ borrowCount: -1, ratingAvg: -1, title: 1, _id: 1 })
    .limit(max)
    .lean();

  return serialiseAll(docs as unknown as Array<Record<string, unknown>>);
}

/**
 * What the catalog filter panel can offer (F5).
 *
 * Counts are taken over **active** books and are deliberately *not* narrowed by the
 * other active filters: a facet that renumbers itself as you type reads as
 * disappearing options, and the count is a hint about the shelf, not a promise
 * about the current result set.
 *
 * One aggregation for the counts and one pair of distinct queries for languages
 * and the year bounds — three round trips total, and none of them scales with the
 * number of books.
 */
export async function getCatalogFacets(): Promise<CatalogFacets> {
  const [rows, languages, bounds] = await Promise.all([
    Category.aggregate<{ _id: Types.ObjectId; name: string; slug: string; icon: string; color: string; count: number }>(
      [
        {
          $lookup: {
            from: Book.collection.name,
            let: { categoryId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$category", "$$categoryId"] }, status: "active" } },
              { $count: "count" },
            ],
            as: "books",
          },
        },
        { $project: { name: 1, slug: 1, icon: 1, color: 1, count: { $ifNull: [{ $first: "$books.count" }, 0] } } },
        { $sort: { name: 1 } },
      ],
    ),
    Book.distinct("language", { status: "active" }),
    Book.aggregate<{ min: number | null; max: number | null }>([
      { $match: { status: "active", publishedYear: { $ne: null } } },
      { $group: { _id: null, min: { $min: "$publishedYear" }, max: { $max: "$publishedYear" } } },
    ]),
  ]);

  const currentYear = new Date().getFullYear();
  const range = bounds[0];

  return {
    categories: rows.map((row) => ({
      _id: row._id.toString(),
      name: row.name,
      slug: row.slug,
      icon: String(row.icon ?? DEFAULT_CATEGORY_ICON),
      color: isCategoryColor(row.color) ? row.color : DEFAULT_CATEGORY_COLOR,
      count: row.count,
    })),
    // Sorted so the dropdown order is stable; `distinct` returns them unordered.
    languages: languages.filter((l): l is string => typeof l === "string").sort((a, b) => a.localeCompare(b)),
    yearRange: {
      // A brand-new library has no dated books yet; fall back to a usable decade
      // rather than rendering a slider pinned at 0.
      from: range?.min ?? currentYear - 10,
      to: range?.max ?? currentYear,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

/** Reject an ISBN already used by another book, surfacing it as a field error. */
async function assertIsbnFree(isbn: string | undefined, excludeId?: Types.ObjectId): Promise<void> {
  if (!isbn) return;

  const clash = await Book.exists({
    isbn,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

  if (clash) {
    throw AppError.conflict("Another book already uses that ISBN.", {
      isbn: "Another book already uses that ISBN",
    });
  }
}

/** Ensure the category exists before referencing it, so no dangling ref. */
async function assertCategoryExists(id: string): Promise<void> {
  const exists = await Category.exists({ _id: new Types.ObjectId(id) });
  if (!exists) {
    throw AppError.validation("Choose a category.", { category: "That category no longer exists" });
  }
}

/**
 * Unique slug: `slugify(title)` with a short id suffix when it is taken.
 *
 * Two books may legitimately share a title, and the slug is a unique index.
 */
async function uniqueSlug(title: string, excludeId?: Types.ObjectId): Promise<string> {
  const base = slugify(title) || "book";

  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const clash = await Book.exists({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return candidate;
  }

  // Deterministic last resort rather than looping forever on a pathological set.
  return `${base}-${new Types.ObjectId().toString().slice(-6)}`;
}

/**
 * Create a book.
 *
 * `availableCopies` is set to `totalCopies` here and nowhere else on create
 * (invariant 6): the request schema does not even accept the field, so a client
 * cannot seed a book as "already on loan".
 */
export async function createBook(input: CreateBookInput, actor: Actor): Promise<BookDetail> {
  await assertCategoryExists(input.category);
  await assertIsbnFree(input.isbn);

  const slug = await uniqueSlug(input.title);

  const created = await Book.create({
    title: input.title,
    slug,
    authors: input.authors,
    // Omitted, never `null`: `isbn` is a sparse unique index, so a stored null
    // would collide with every other ISBN-less book. See the model comment.
    ...(input.isbn ? { isbn: input.isbn } : {}),
    publisher: input.publisher ?? null,
    edition: input.edition ?? null,
    publishedYear: input.publishedYear ?? null,
    language: input.language,
    category: new Types.ObjectId(input.category),
    tags: input.tags ?? [],
    description: input.description ?? null,
    pageCount: input.pageCount ?? null,
    cover: input.cover ?? null,
    shelfLocation: input.shelfLocation ?? null,
    totalCopies: input.totalCopies,
    availableCopies: input.totalCopies,
    status: "active",
    addedBy: actor.id,
  });

  await logAudit({
    actor,
    action: "book.create",
    entityType: "Book",
    entityId: created._id,
    summary: `Added book "${created.title}"`,
    meta: {
      slug,
      isbn: created.isbn ?? null,
      totalCopies: created.totalCopies,
      category: String(created.category),
    },
  });

  const categories = await categoryMap([created.category as Types.ObjectId]);
  const lean = created.toObject() as unknown as Record<string, unknown>;

  return {
    ...toApi(lean, categories.get(String(created.category)) ?? null),
    onLoan: 0,
    waitingReservations: 0,
  };
}

/**
 * Update a book.
 *
 * Copy arithmetic (business rule 10): `availableCopies` moves by the *delta* of
 * `totalCopies`, so adding 2 copies to a shelf with 3 of 5 out makes 5 of 7
 * available, while removing copies can never strand `availableCopies` below
 * zero. That rejection is the "N copies are currently on loan" case.
 */
export async function updateBook(
  id: string,
  input: UpdateBookInput,
  actor: Actor,
): Promise<BookDetail> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That book could not be found.");

  const book = await Book.findById(id);
  if (!book) throw AppError.notFound("That book could not be found.");

  if (input.category) {
    await assertCategoryExists(input.category);
    book.category = new Types.ObjectId(input.category) as unknown as BookDoc["category"];
  }
  await assertIsbnFree(input.isbn, book._id);

  const before = {
    title: book.title,
    authors: book.authors,
    isbn: book.isbn ?? null,
    language: book.language,
    totalCopies: book.totalCopies,
    availableCopies: book.availableCopies,
    status: book.status,
  };

  if (input.title !== undefined && input.title !== book.title) {
    book.title = input.title;
    // Keep the public URL aligned with the title (spec 08).
    book.slug = await uniqueSlug(input.title, book._id);
  }
  if (input.authors !== undefined) book.authors = input.authors;
  // `undefined` clears the field in Mongoose, which `$unset`s it — the only way to
  // remove an ISBN without writing a null that trips the sparse unique index.
  if (input.isbn !== undefined) book.isbn = input.isbn;
  if (input.publisher !== undefined) book.publisher = input.publisher ?? null;
  if (input.edition !== undefined) book.edition = input.edition ?? null;
  if (input.publishedYear !== undefined) book.publishedYear = input.publishedYear ?? null;
  if (input.language !== undefined) book.language = input.language;
  if (input.tags !== undefined) book.tags = input.tags;
  if (input.description !== undefined) book.description = input.description ?? null;
  if (input.pageCount !== undefined) book.pageCount = input.pageCount ?? null;
  if (input.shelfLocation !== undefined) book.shelfLocation = input.shelfLocation ?? null;
  if (input.cover !== undefined) book.cover = input.cover ?? null;

  if (input.totalCopies !== undefined && input.totalCopies !== book.totalCopies) {
    const delta = input.totalCopies - book.totalCopies;
    const nextAvailable = book.availableCopies + delta;
    const onLoan = book.totalCopies - book.availableCopies;

    if (nextAvailable < 0) {
      throw AppError.rule(
        `“${book.title}” has ${onLoan} ${onLoan === 1 ? "copy" : "copies"} out on loan, so the total cannot go below ${onLoan}. Return a copy first, or set the total to ${book.totalCopies}.`,
        { totalCopies: `At least ${onLoan} copies are on loan` },
      );
    }

    book.totalCopies = input.totalCopies;
    book.availableCopies = nextAvailable;
  }

  await book.save();

  await logAudit({
    actor,
    action: "book.update",
    entityType: "Book",
    entityId: book._id,
    summary: `Updated book "${book.title}"`,
    meta: {
      before,
      after: {
        title: book.title,
        authors: book.authors,
        isbn: book.isbn ?? null,
        language: book.language,
        totalCopies: book.totalCopies,
        availableCopies: book.availableCopies,
        status: book.status,
      },
    },
  });

  const categories = await categoryMap([book.category as Types.ObjectId]);
  const [lean, waiting] = await Promise.all([
    Promise.resolve(book.toObject() as unknown as Record<string, unknown>),
    Reservation.countDocuments({
      book: book._id,
      status: { $in: ["waiting", "ready"] },
    }),
  ]);

  return {
    ...toApi(lean, categories.get(String(book.category)) ?? null),
    onLoan: Math.max(0, book.totalCopies - book.availableCopies),
    waitingReservations: waiting,
  };
}

/** Archive or restore. Archived books drop out of the public catalog. */
export async function setArchived(
  id: string,
  archived: boolean,
  actor: Actor,
): Promise<BookDetail> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That book could not be found.");

  const book = await Book.findById(id);
  if (!book) throw AppError.notFound("That book could not be found.");

  const previous = book.status;
  if (previous === (archived ? "archived" : "active")) {
    // Nothing to do; still return the book so the client can settle its cache.
    return getBook(book._id.toString());
  }

  book.status = archived ? "archived" : "active";
  await book.save();

  await logAudit({
    actor,
    action: archived ? "book.archive" : "book.restore",
    entityType: "Book",
    entityId: book._id,
    summary: `${archived ? "Archived" : "Restored"} book "${book.title}"`,
    meta: { from: previous, to: book.status },
  });

  return getBook(book._id.toString());
}

/**
 * Hard delete a book that has never been loaned.
 *
 * Business rule 10: with any loan in history the book must be archived instead,
 * otherwise circulation history would dangle. The Cloudinary cover is destroyed
 * only after the database delete succeeds, so a failed delete never orphans the
 * image.
 */
export async function deleteBook(id: string, actor: Actor): Promise<{ id: string }> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That book could not be found.");

  const book = await Book.findById(id);
  if (!book) throw AppError.notFound("That book could not be found.");

  const loanCount = await Loan.countDocuments({ book: book._id });
  if (loanCount > 0) {
    throw AppError.rule(
      `“${book.title}” has been loaned ${loanCount} ${loanCount === 1 ? "time" : "times"} and cannot be deleted. Archive it instead — the loan history needs to stay.`,
      { status: "Archive this book instead of deleting it" },
    );
  }

  const holdCount = await Reservation.countDocuments({
    book: book._id,
    status: { $in: ["waiting", "ready"] },
  });
  if (holdCount > 0) {
    throw AppError.rule(
      `“${book.title}” has ${holdCount} active ${holdCount === 1 ? "reservation" : "reservations"}. Cancel ${
        holdCount === 1 ? "it" : "them"
      } before deleting this book.`,
    );
  }

  const cover = (book.cover as CloudinaryImage | null)?.publicId ?? null;
  const title = book.title;

  await Book.deleteOne({ _id: book._id });

  // Only after the row is gone, so a failed delete cannot orphan the asset.
  // `destroyAsset` already swallows its own failures and returns a boolean.
  if (cover) {
    const destroyed = await destroyAsset(cover);
    if (!destroyed) {
      console.error("[books] cover could not be destroyed", { publicId: cover });
    }
  }

  await logAudit({
    actor,
    action: "book.delete",
    entityType: "Book",
    entityId: id,
    summary: `Deleted book "${title}"`,
    meta: { coverDestroyed: Boolean(cover), publicId: cover },
  });

  return { id };
}

/** Archive many books at once, reporting which ids were actually changed. */
export async function bulkArchive(
  ids: string[],
  actor: Actor,
): Promise<{ archived: number; ids: string[]; skipped: number }> {
  const objectIds = ids.map((id) => new Types.ObjectId(id));

  // Only books already active are touched, so the audit log records real changes.
  const result = await Book.updateMany(
    { _id: { $in: objectIds }, status: "active" },
    { $set: { status: "archived" } },
  );

  const changedIds = (result.modifiedCount > 0
    ? await Book.find({ _id: { $in: objectIds }, status: "archived" })
        .select("_id title")
        .lean()
    : []
  ) as unknown as Array<{ _id: Types.ObjectId; title: string }>;

  await logAudit({
    actor,
    action: "book.bulk_archive",
    entityType: "Book",
    entityId: objectIds[0],
    summary: `Archived ${result.modifiedCount} ${result.modifiedCount === 1 ? "book" : "books"}`,
    meta: {
      requested: ids.length,
      archived: result.modifiedCount,
      titles: changedIds.slice(0, 25).map((doc) => doc.title),
    },
  });

  return {
    archived: result.modifiedCount,
    ids: ids,
    skipped: ids.length - result.modifiedCount,
  };
}
