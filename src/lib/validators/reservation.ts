import { z } from "zod";
import { PAGINATION, RESERVATION_STATUSES } from "@/lib/constants";

/**
 * Reservation validators (spec 14).
 *
 * **Shape only.** `maxReservationsPerMember` and `reservationHoldHours` are read from the
 * settings singleton by `lib/services/reservations.ts` at request time (invariant 7), so
 * there is deliberately no `.max(3)` here — a zod cap would freeze the policy into the
 * transport layer and silently disagree with the admin who changes it in Settings.
 */

/** A Mongo ObjectId as a path or query parameter. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** `/api/reservations/:id` and `/api/reservations/:id/fulfil`. */
export const reservationParamSchema = z.object({ id: objectId });

/**
 * `POST /api/reservations` — a member joins a queue.
 *
 * Only the book. The member comes from the session (invariant 3), so a client cannot
 * reserve on somebody else's behalf by editing the body.
 */
export const reserveBookSchema = z.object({
  bookId: objectId,
});

/**
 * `status` as a **comma-separated list**, e.g. `?status=waiting,ready`.
 *
 * A single-value enum is not enough for this screen: the staff tabs are Ready, Waiting and
 * History, and History is three states (`fulfilled`, `cancelled`, `expired`). Asking for
 * "everything that is not active" in three round trips would make the tab a lie the moment
 * one of them failed, and omitting `status` entirely is unbounded — one paginated request
 * per tab is exactly what `meta` is for.
 *
 * Every token is checked against `RESERVATION_STATUSES`, so a typo is a 422 naming the
 * valid values rather than an empty table.
 */
const statusFilter = z
  .string()
  .trim()
  .transform((raw) =>
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  )
  // Piped into the enum so the *output* type is `ReservationStatus[]` rather than
  // `string[]`. A `string[]` would force a cast in the service — and a cast at a filter
  // boundary is exactly how an unknown status reaches the database and silently matches
  // nothing. An unrecognised token is a 422 naming the valid values.
  .pipe(z.array(z.enum(RESERVATION_STATUSES)).min(1, `Use one or more of: ${RESERVATION_STATUSES.join(", ")}`))
  .refine((values) => new Set(values).size === values.length, {
    message: "Do not repeat a status",
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
 * `GET /api/reservations` — the staff register.
 *
 * `status` is optional, so no filter means *every* reservation rather than silently hiding
 * the closed ones. `bookId` narrows to one book's queue, which is what the "View queue"
 * sheet in the books table sends.
 */
export const listReservationsQuerySchema = z.object({
  status: statusFilter.optional(),
  bookId: objectId.optional(),
  page: pageQuery,
  limit: limitQuery,
});

/**
 * `GET /api/reservations/mine` — no member id, no filters.
 *
 * The member comes from the session (invariant 3), and the response is already grouped
 * into ready / waiting / past, so there is nothing for a query string to select. Accepting
 * a `status` here would only invite a client to drop one of the three groups.
 */
export const listMyReservationsQuerySchema = z.object({});

export type ReserveBookInput = z.infer<typeof reserveBookSchema>;
export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;