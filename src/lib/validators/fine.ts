import { z } from "zod";
import { FINE_STATUSES, PAGINATION, PAYMENT_METHODS } from "@/lib/constants";

/**
 * Fine validators (spec 13).
 *
 * **Shape only.** No policy numbers here — `finePerDay` and `maxFinePerLoan` are read from
 * the settings singleton by `lib/services/fines.ts` at request time (invariant 7), and a
 * `zod` cap in the transport layer would freeze the policy into the validator.
 *
 * The one policy-adjacent field *is* validated, because it is not policy: `amount` on a
 * collect request must be positive money. It is a number the client could otherwise send as
 * `0` or `-5`, and a negative payment is nonsense regardless of any setting.
 */

/** A Mongo ObjectId as a path or query parameter. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** `/api/fines/:id/collect` and `/api/fines/:id/waive`. */
export const fineParamSchema = z.object({ id: objectId });

/**
 * `POST /api/fines/:id/collect` — staff records a payment.
 *
 * `amount` is required rather than defaulting to the fine's value: an admin recording a
 * part payment must say how much was actually taken, and defaulting would silently make
 * every part payment a full settlement. The service checks it against the outstanding
 * amount.
 */
export const collectFineSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),
  /** Positive currency units. */
  amount: z.coerce
    .number()
    .positive("Enter an amount greater than zero")
    .max(1_000_000, "That amount looks wrong"),
  note: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/**
 * `POST /api/fines/:id/waive` — staff forgives a fine.
 *
 * **A reason is required**, and that is the whole point: waiving someone's debt is the one
 * fine action with no trace of who decided it or why. `min(3)` is the floor from the
 * suspend dialog, for the same reason.
 */
export const waiveFineSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Give a short reason so the record explains itself")
    .max(500, "Keep the reason under 500 characters"),
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
 * `GET /api/fines` — the staff fine table.
 *
 * `status` is optional, so no filter means *all* fines rather than silently hiding the
 * paid ones. `from`/`to` are `YYYY-MM-DD` and bound `createdAt`, which is when the fine was
 * raised — the date an admin filters by when reconciling a month's takings.
 */
export const listFinesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(FINE_STATUSES).optional(),
  memberId: objectId.optional(),
  bookId: objectId.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional(),
  page: pageQuery,
  limit: limitQuery,
});

/** `GET /api/fines/mine` — no member id; it comes from the session (invariant 3). */
export const listMyFinesQuerySchema = z.object({
  status: z.enum(FINE_STATUSES).optional(),
  page: pageQuery,
  limit: limitQuery,
});

export type CollectFineInput = z.output<typeof collectFineSchema>;
export type WaiveFineInput = z.output<typeof waiveFineSchema>;
export type ListFinesQuery = z.infer<typeof listFinesQuerySchema>;
export type ListMyFinesQuery = z.infer<typeof listMyFinesQuerySchema>;