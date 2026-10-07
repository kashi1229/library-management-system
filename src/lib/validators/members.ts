import { z } from "zod";
import { PAGINATION, STAFF_ROLES, USER_STATUSES } from "@/lib/constants";
import { emailSchema, passwordSchema } from "@/lib/validators/auth";
import { isValidMembershipId } from "@/lib/membership-id";

/**
 * Member and staff schemas (spec 10).
 *
 * `createLibrarianSchema` deliberately reuses `emailSchema` and `passwordSchema`
 * rather than restating the rules, so a librarian account and a member registration
 * can never drift apart on what counts as a valid email or password.
 *
 * The list-query schemas follow `lib/validators/book.ts`: `z.coerce` for numbers that
 * arrive as strings, defaults from `PAGINATION`, and — importantly — **no `.extend()`
   on a refined schema**, which Zod 4 rejects at runtime and only `next build` catches.
 */

/** `/staff/members/:id` — a Mongo ObjectId. */
export const memberIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid member id"),
});

export const listMembersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(USER_STATUSES).optional(),
  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .optional()
    .default(PAGINATION.defaultPage),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.maxLimit)
    .optional()
    .default(20),
});

/** `/staff/members/lookup?q=` — the circulation desk type-ahead. */
export const lookupQuerySchema = z.object({
  q: z.string().trim().min(1, "Type a name, email or membership ID").max(120),
});

/**
 * A suspension always carries a reason.
 *
 * It is shown to the member on their next sign-in (`SuspendedBanner`) and written to
 * the audit log, so a bare status flip would leave both blank. Trimmed and capped at
 * the model's own 500 characters so a long paste cannot silently truncate in Mongo.
 */
export const suspendMemberSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Give a short reason so the member knows what to change")
    .max(500, "Keep the reason under 500 characters"),
});

/**
 * The one rule for a staff member's name.
 *
 * Composed into `createLibrarianSchema`, `updateTeamMemberSchema` and
 * `renameTeamMemberSchema` rather than restated in each. Three copies of
 * `min(2).max(80)` is three places for the limit to drift, and the drift shows up as a
 * form that accepts a name the API then rejects with a generic 500 — the same shape as
 * the Unit 08 model-cap mismatch.
 *
 * Messages live here too, so the create dialog and the rename dialog tell the user the
 * same thing.
 */
const staffNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Keep the name under 80 characters");

/**
 * Admin creating a staff account — a librarian or an administrator (F1, F6).
 *
 * The password is generated **in the browser** by `lib/password-generator.ts` and
 * validated here with the same `passwordSchema` a member's own sign-up uses. Generating
 * it client-side means the admin can read it before committing, so a mistyped email is
 * caught before the account exists — and it still goes through the server validator,
 * because a request that did not come from our own dialog could send anything.
 *
 * **`role` defaults to `librarian`.** Defaulting rather than requiring it means the
 * common case needs no field, and a caller that forgets the key cannot accidentally mint
 * an administrator. Creating one is a deliberate choice, and it is the choice the
 * service re-checks against the actor's own role.
 *
 * Note the Zod 4 trap from Unit 08 in reverse: this schema carries a `.default()`, so
 * nothing may call `.partial()` or `.extend()` on it. A partial would keep the inner
 * default and silently reset the role on every edit.
 *
 * `phone` accepts `""` and normalises it to `undefined`. An optional field left blank
 * submits as an empty string, and storing `""` would break the "no phone number"
 * check that a real `null` satisfies.
 */
export const createStaffMemberSchema = z.object({
  name: staffNameSchema,
  email: emailSchema,
  /** Must satisfy the shared password policy. */
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d{7,15}$/, "Use digits, optionally starting with +")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  role: z.enum(STAFF_ROLES).default("librarian"),
});

/** Admin editing a librarian: name and/or status only. Role is not editable. */
export const updateTeamMemberSchema = z
  .object({
    name: staffNameSchema.optional(),
    /** `active` re-enables; `suspended` disables a staff account. */
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: "Send a name or a status to update.",
  });

/**
 * The rename dialog's own schema: a name, and nothing else.
 *
 * A plain object rather than `updateTeamMemberSchema` reused, because that one carries a
 * `.refine()` requiring *a name or a status* — which is correct for a partial PATCH and
 * meaningless for a form whose only field is the name. Submitting it from a form would
 * also leave the resolver able to pass an empty payload.
 */
export const renameTeamMemberSchema = z.object({
  name: staffNameSchema,
});

/**
 * Re-exported so a client form can validate a membership ID against the exact pattern
 * the server uses.
 *
 * From `lib/membership-id.ts`, **not** `lib/services/membership.ts`. The service is
 * `server-only`; importing it from here once pulled mongoose into the browser bundle,
 * and only `next build` caught it — `tsc` and `eslint` both passed.
 */
export { isValidMembershipId };

export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;
export type LookupQuery = z.infer<typeof lookupQuerySchema>;
export type CreateStaffMemberValues = z.input<typeof createStaffMemberSchema>;
export type CreateStaffMemberInput = z.output<typeof createStaffMemberSchema>;
export type UpdateTeamMemberInput = z.output<typeof updateTeamMemberSchema>;
export type RenameTeamMemberValues = z.input<typeof renameTeamMemberSchema>;
export type RenameTeamMemberInput = z.output<typeof renameTeamMemberSchema>;