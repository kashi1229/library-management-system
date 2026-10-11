import { z } from "zod";
import { PAGINATION, REPORT_TYPES } from "@/lib/constants";

/**
 * Report and audit validators (spec 18).
 *
 * **Shape only, like every other validator in this folder.** No policy number appears here; the
 * fine-per-day used by the "potential fine" column is read from the Settings singleton by
 * `services/reports.ts` at request time (invariant 7), because a `.max()` or a literal rate in a
 * zod schema would freeze the policy into the transport layer and silently disagree with the
 * admin who changes it.
 */

/** A Mongo ObjectId as a query parameter. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** `YYYY-MM-DD`. Bounds are interpreted inclusively, and resolved to UTC day edges server-side. */
const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const pageQuery = z.coerce.number().int().min(1).max(100000).optional().default(PAGINATION.defaultPage);

const limitQuery = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGINATION.maxLimit)
  .optional()
  .default(PAGINATION.defaultLimit);

/** `GET /api/reports/:type` */
export const reportTypeSchema = z.object({
  type: z.enum(REPORT_TYPES),
});

/**
 * The shared report filter set.
 *
 * **`sort`/`dir` live here even though the spec only lists `from,to,categoryId`.** Sorting has to
 * happen in the database because the rows are paginated: sorting a page in the browser would order
 * one page correctly and then splice the next page's rows into the wrong places. A report that
 * says "sort by fine" and then puts the biggest fine on page four has not sorted anything.
 */
export const reportQuerySchema = z.object({
  /** Inclusive lower bound, applied to the report's own date field. */
  from: dayString.optional(),
  /** Inclusive upper bound. */
  to: dayString.optional(),
  /** Narrow to one category, where the report has a category at all. */
  categoryId: objectId.optional(),
  /** A column key from the report's own `columns`; an unknown key is ignored, not a 422. */
  sort: z.string().trim().max(40).optional(),
  dir: z.enum(["asc", "desc"]).optional().default("desc"),
  format: z.literal("csv").optional(),
  page: pageQuery,
  limit: limitQuery,
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "The start date must be on or before the end date",
  path: ["from"],
});

/** `GET /api/audit` — admin only. */
export const listAuditQuerySchema = z.object({
  /** A specific actor, as an id. Staff names are a free-text field, so filtering by them would be
   *  a regex scan over 30,000 entries; the id is indexed. */
  actor: objectId.optional(),
  /** An exact action string, e.g. `loan.issue`. Indexed. */
  action: z.string().trim().max(80).optional(),
  from: dayString.optional(),
  to: dayString.optional(),
  q: z.string().trim().max(120).optional(),
  page: pageQuery,
  limit: limitQuery,
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "The start date must be on or before the end date",
  path: ["from"],
});

export type ReportTypeParam = z.infer<typeof reportTypeSchema>;
export type ReportQuery = z.infer<typeof reportQuerySchema>;
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

/** `z.input` for the query forms, because the client sends numbers as strings. */
export type ReportQueryInput = z.input<typeof reportQuerySchema>;
export type ListAuditQueryInput = z.input<typeof listAuditQuerySchema>;