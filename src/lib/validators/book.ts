import { z } from "zod";
import {
  BOOK_AVAILABILITIES,
  BOOK_SORTS as BOOK_SORTS_CONST,
  BOOK_SORT_LABELS,
  BOOK_STATUSES,
  LANGUAGES,
  PAGINATION,
} from "@/lib/constants";
import { slugify } from "@/lib/validators/category";
import type { BookSort, BookStatus } from "@/lib/constants";

/**
 * Book schemas, shared verbatim by the API and the create/edit form
 * (`code-standards.md` §Forms: one schema, one source of truth).
 *
 * Every optional numeric field accepts `""` from an empty input and normalises to
 * `undefined`, so a cleared field is "absent" rather than a validation error.
 */

/* -------------------------------------------------------------------------- */
/* ISBN                                                                       */
/* -------------------------------------------------------------------------- */

/** Strip hyphens and spaces; uppercase the check digit. */
export function normalizeIsbn(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Validate an ISBN-10 or ISBN-13 checksum.
 *
 * Both schemes are mod-11 weighted sums: ISBN-10 weights 10→1, ISBN-13 weights
 * 1 and 3 alternating. Accepts the `X` check digit in either position.
 */
export function isValidIsbn(raw: string): boolean {
  const isbn = normalizeIsbn(raw);

  if (/^\d{9}[\dX]$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const digit = isbn[i] === "X" ? 10 : Number(isbn[i]);
      sum += digit * (10 - i);
    }
    return sum % 11 === 0;
  }

  if (/^(978|979)\d{10}$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0;
  }

  return false;
}

/** Optional ISBN that still checksums when present. */
const isbnField = z
  .string()
  .trim()
  .max(32, "ISBN is too long")
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;

    const normalized = normalizeIsbn(value);
    // Wrong length or a non-digit where a digit belongs.
    if (!/^(\d{9}[\dX]|(978|979)\d{10})$/.test(normalized)) {
      ctx.addIssue({
        code: "custom",
        message: "ISBN must be 10 or 13 digits, optionally ending in X",
      });
      return z.NEVER;
    }
    if (!isValidIsbn(normalized)) {
      ctx.addIssue({ code: "custom", message: "That ISBN fails its check digit" });
      return z.NEVER;
    }
    return normalized;
  });

/* -------------------------------------------------------------------------- */
/* Chips (authors, tags)                                                      */
/* -------------------------------------------------------------------------- */

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 24;

/** One author name. Trimmed and collapsed so " Ada  Lovelace " stores cleanly. */
const authorField = z
  .string()
  .trim()
  .min(1, "Author names cannot be blank")
  .max(80, "Author names must be 80 characters or fewer");

const authorsField = z
  .array(authorField)
  .min(1, "Add at least one author")
  .max(12, "A book cannot have more than 12 authors")
  .transform((list) => list.map((name) => name.replace(/\s+/g, " ")));

/** Tags are lowercased and de-duplicated so filtering stays predictable. */
const tagsField = z
  .array(z.string().trim().min(1).max(MAX_TAG_LENGTH))
  .max(MAX_TAGS, `A book can have at most ${MAX_TAGS} tags`)
  .optional()
  .transform((list) => {
    if (!list) return undefined;
    const seen = new Set<string>();
    const out: string[] = [];
    for (const tag of list) {
      const clean = tag.toLowerCase().replace(/\s+/g, "-").slice(0, MAX_TAG_LENGTH);
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        out.push(clean);
      }
    }
    return out;
  });

/* -------------------------------------------------------------------------- */
/* Numbers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * An optional number that accepts a string **or** a number.
 *
 * The union is not defensive padding, it is required: `<input type="number">`
 * makes react-hook-form store a JS number, so a `z.string()`-only schema fails
 * with `expected string, received number` and **the edit form cannot be saved for
 * any book that has a year or a page count**. The server then rejects perfectly
 * good input from its own UI. `totalCopies` has always accepted both; these two
 * fields now behave identically instead of differing by accident.
 *
 * Empty input (or a `null` that means "absent") becomes `undefined` rather than a
 * NaN validation error, so clearing a field is not an error.
 */
function optionalNumber(
  min: number,
  max: number,
  message: string,
): z.ZodPipe<
  z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>,
  z.ZodTransform<number | undefined, string | number | undefined>
> {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((value, ctx) => {
      if (value === null || value === undefined || value === "") return undefined;

      const parsed = typeof value === "number" ? value : Number(value.trim());
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: "custom", message: "Enter a number" });
        return z.NEVER;
      }
      if (parsed < min || parsed > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return Math.trunc(parsed);
    });
}

const CURRENT_YEAR_PLUS_ONE = new Date().getFullYear() + 1;

/* -------------------------------------------------------------------------- */
/* Create / update                                                            */
/* -------------------------------------------------------------------------- */

const coverField = z.object({
  url: z.string().trim().url("Cover URL is not valid").max(500),
  publicId: z.string().trim().min(1, "Cover is missing its public id").max(300),
});

const titleField = z
  .string()
  .trim()
  .min(2, "Title must be at least 2 characters")
  .max(200, "Title must be 200 characters or fewer");

/**
 * Create schema.
 *
 * `availableCopies` is **deliberately absent**: invariant 6 says only circulation
 * services and total-copy edits may write it, and on create the service sets it
 * equal to `totalCopies`. Accepting it here would be a mass-assignment hole.
 */
export const createBookSchema = z.object({
  title: titleField,
  authors: authorsField,
  isbn: isbnField,
  publisher: z.string().trim().max(200, "Publisher is too long").optional(),
  edition: z.string().trim().max(80, "Edition is too long").optional(),
  publishedYear: optionalNumber(1000, CURRENT_YEAR_PLUS_ONE, "Year must be 1000 or later"),
  language: z.string().trim().min(1, "Choose a language").max(60).default("English"),
  category: z.string().regex(/^[a-f\d]{24}$/i, "Choose a category"),
  tags: tagsField,
  description: z
    .string()
    .trim()
    .max(2000, "Description must be 2000 characters or fewer")
    .optional()
    .transform((value) => (value ? value : undefined)),
  pageCount: optionalNumber(1, 10000, "Page count must be between 1 and 10000"),
  shelfLocation: z
    .string()
    .trim()
    .max(20, "Shelf location must be 20 characters or fewer")
    .optional()
    .transform((value) => (value ? value : undefined)),
  totalCopies: z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const parsed = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        ctx.addIssue({ code: "custom", message: "Enter a whole number of copies" });
        return z.NEVER;
      }
      if (parsed < 1 || parsed > 999) {
        ctx.addIssue({ code: "custom", message: "Copies must be between 1 and 999" });
        return z.NEVER;
      }
      return parsed;
    }),
  cover: coverField.nullish(),
});

/**
 * Update schema.
 *
 * Built from **the same field schemas**, not `createBookSchema.partial()`:
 * Zod 4's `.partial()` keeps an inner `.default()`, which silently re-applied
 * `language: "English"` to every PATCH and clobbered the stored value — the same
 * trap that hit `updateCategorySchema` in Unit 07. A `.refine()` also rejects an
 * empty body so a no-op PATCH cannot write an audit entry claiming a change.
 */
export const updateBookSchema = z
  .object({
    title: titleField.optional(),
    authors: authorsField.optional(),
    isbn: isbnField,
    publisher: z.string().trim().max(200).optional(),
    edition: z.string().trim().max(80).optional(),
    publishedYear: optionalNumber(1000, CURRENT_YEAR_PLUS_ONE, "Year must be 1000 or later"),
    language: z.string().trim().min(1).max(60).optional(),
    category: z.string().regex(/^[a-f\d]{24}$/i, "Choose a category").optional(),
    tags: tagsField,
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((value) => (value ? value : undefined)),
    pageCount: optionalNumber(1, 10000, "Page count must be between 1 and 10000"),
    shelfLocation: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((value) => (value ? value : undefined)),
    totalCopies: z
      .union([z.string(), z.number()])
      .transform((value, ctx) => {
        if (value === "" || value === undefined) return undefined;
        const parsed = typeof value === "number" ? value : Number(String(value).trim());
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
          ctx.addIssue({ code: "custom", message: "Enter a whole number of copies" });
          return z.NEVER;
        }
        if (parsed < 1 || parsed > 999) {
          ctx.addIssue({ code: "custom", message: "Copies must be between 1 and 999" });
          return z.NEVER;
        }
        return parsed;
      })
      .optional(),
    cover: coverField.nullish(),
  })
    // "Was a field supplied?" is about the raw request, not the parsed output:
    // `isbn: ""`, `totalCopies: ""` and `tags: []` all parse to `undefined` yet
    // are still meaningful sends. Testing `Object.values(...)` instead would
    // reject a legitimate "clear this field" PATCH.
    .refine((value) => Object.keys(value).length > 0, {
      message: "Send at least one field to update.",
    });

/* -------------------------------------------------------------------------- */
/* Queries and params                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Staff sorts re-exported from `lib/constants.ts` rather than redeclared here.
 * Two arrays of the same names is exactly how a sort option ends up accepted by
 * the API but missing from the toolbar (which happened to `updateCategorySchema`
 * in Unit 07 — see the note on `updateBookSchema`).
 */
export const BOOK_SORTS = BOOK_SORTS_CONST;
export type { BookSort };

/**
 * The four sorts that mean something to a reader.
 *
 * A strict subset of `BOOK_SORTS`, derived from it rather than hand-written so the
 * two cannot disagree. `oldest` and `authors` are staff-only conveniences; offering
 * a visitor "Oldest first" on a catalog page is noise.
 */
export const PUBLIC_BOOK_SORTS = ["newest", "title", "popular", "rating"] as const satisfies readonly BookSort[];
export type PublicBookSort = (typeof PUBLIC_BOOK_SORTS)[number];

/** The staff table also needs `all`, which the public catalog has no use for. */
export const BOOK_STATUS_FILTERS = ["active", "archived", "all"] as const;
export type BookStatusFilter = (typeof BOOK_STATUS_FILTERS)[number];

const pageQuery = z.coerce
  .number()
  .int()
  .min(1)
  .max(100000)
  .optional()
  .default(PAGINATION.defaultPage);

const limitQuery = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGINATION.maxLimit)
  .optional()
  .default(PAGINATION.defaultLimit);

/**
 * `GET /api/books` — shared by the staff table (Unit 08) and the public catalog.
 *
 * `availability`, `yearFrom` and `yearTo` are catalog-only, but they live on the
 * one query schema so a single `buildQuery` serves both callers. The staff table
 * simply never sends them.
 */
export const listBooksQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    category: z.string().regex(/^[a-f\d]{24}$/i).optional(),
    language: z.string().trim().max(60).optional(),
    /** `available` keeps only books a reader could actually borrow today. */
    availability: z.enum(BOOK_AVAILABILITIES).optional(),
    yearFrom: z.coerce.number().int().min(1000).max(3000).optional(),
    yearTo: z.coerce.number().int().min(1000).max(3000).optional(),
    status: z.enum(BOOK_STATUS_FILTERS).optional().default("active"),
    sort: z.enum(BOOK_SORTS).optional().default("newest"),
    page: pageQuery,
    limit: limitQuery,
  })
  // An inverted range would silently return nothing, which reads as a bug rather
  // than as the user swapping two sliders. Rejecting it names the real problem.
  .refine((value) => value.yearFrom === undefined || value.yearTo === undefined || value.yearFrom <= value.yearTo, {
    message: "The earliest year must not be after the latest.",
    path: ["yearFrom"],
  });

/**
 * Staff table filter: a concrete status or `all`.
 *
 * `safeExtend`, not `extend`: Zod 4 refuses `.extend()` on a schema that carries a
 * refinement, because extending it could invalidate the refinement's assumptions.
 * `listBooksQuerySchema` has the inverted-year-range check, so `.extend()` threw at
 * **runtime** — `tsc` and `eslint` were both perfectly happy and only
 * `next build` failed, during page-data collection.
 */
export const staffBooksQuerySchema = listBooksQuerySchema.safeExtend({
  status: z.enum(BOOK_STATUS_FILTERS).optional().default("all"),
});

/**
 * `GET /api/books/facets` — what the filter panel offers.
 *
 * The category id is validated here rather than being ignored, so a hand-edited
 * URL that asks for facets of a deleted category is a 422 instead of a filter
 * panel showing a category that can never match anything.
 */
export const facetsQuerySchema = z.object({
  category: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

/** `GET /api/books/:slugOrId` and `DELETE /api/books/:id`. */
export const bookParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Invalid book id")
    .max(80, "Invalid book id")
    .regex(/^(?:[a-f\d]{24}|[a-z0-9-]{3,80})$/i, "Invalid book id"),
});

/** `POST /api/books/:id/archive` — `{ archived: boolean }`. */
export const archiveBookSchema = z.object({
  archived: z.boolean(),
});

/** `POST /api/books/bulk-archive` — `{ ids }`. */
export const bulkArchiveSchema = z.object({
  ids: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, "Invalid book id"))
    .min(1, "Select at least one book")
    .max(200, "Select 200 books or fewer"),
});

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type CreateBookValues = z.input<typeof createBookSchema>;
export type CreateBookInput = z.output<typeof createBookSchema>;
export type UpdateBookInput = z.output<typeof updateBookSchema>;
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;
export type StaffBooksQuery = z.infer<typeof staffBooksQuerySchema>;

/** Re-exported so the staff table and the seed script share one source. */
export { BOOK_STATUSES, BOOK_SORT_LABELS, LANGUAGES, slugify };
export type { BookStatus };
