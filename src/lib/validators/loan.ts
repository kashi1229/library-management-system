import { z } from "zod";
import { LOAN_VIEWS, PAGINATION } from "@/lib/constants";

/**
 * Circulation validators (spec 11).
 *
 * **Only the transport layer.** Every policy number — `maxActiveLoans`,
 * `loanPeriodDays`, `maxRenewals` — is read from the Settings singleton by
 * `lib/services/circulation.ts` at request time (invariant 7), never restated here. A
 * zod `.max(5)` on an active-loan count would freeze the policy into the validator and
 * silently disagree with the admin who changes it in Settings.
 *
 * So these schemas validate *shape*, and the service validates *rules*.
 */

/** A Mongo ObjectId as a path/query parameter. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** `/api/loans/:id`, `/api/loans/:id/return`, `/api/loans/:id/renew`. */
export const loanParamSchema = z.object({ id: objectId });

/**
 * `POST /api/loans/issue`
 *
 * The **ids are validated, the policy is not**. `memberId` is role-checked by the
 * service (invariant 3: ownership is derived from the session, and a staff actor naming
 * a member is the one documented exception), and every limit is read from Settings.
 */
export const issueLoanSchema = z.object({
  memberId: objectId,
  /** A book id or slug — the desk has a barcode or a title, not always an id. */
  bookId: z.string().trim().min(1, "Choose a book").max(80, "Choose a book"),
  /** Desk note, e.g. "returned from another branch". */
  notes: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

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
 * `GET /api/loans` — the desk's loan table.
 *
 * `status` is the **derived** filter vocabulary (`overdue` and `due_soon` are computed,
 * never stored), which is exactly `LOAN_VIEWS`. It is `optional()` rather than defaulted
 * so "no status" means *all loans* rather than silently hiding returned ones — the desk
 * opens on "everything", not on a filter nobody chose.
 *
 * `memberId` / `bookId` are the two ways the desk finds a specific loan: by the member
 * at the counter, or by the book being returned.
 */
export const listLoansQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(LOAN_VIEWS).optional(),
  memberId: objectId.optional(),
  bookId: objectId.optional(),
  /** `YYYY-MM-DD`, inclusive lower bound on `issuedAt`. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  /** `YYYY-MM-DD`, inclusive upper bound on `issuedAt`. */
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  page: pageQuery,
  limit: limitQuery,
});

/**
 * `GET /api/loans/mine`
 *
 * **No `memberId`.** "Mine" is resolved from the session (invariant 3), so a member
 * cannot ask for someone else's loans by editing the URL. The one optional parameter is
 * the derived `status`.
 */
export const listMyLoansQuerySchema = z.object({
  status: z.enum(LOAN_VIEWS).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export type IssueLoanValues = z.input<typeof issueLoanSchema>;
export type IssueLoanInput = z.output<typeof issueLoanSchema>;
export type ListLoansQuery = z.infer<typeof listLoansQuerySchema>;
export type ListMyLoansQuery = z.infer<typeof listMyLoansQuerySchema>;