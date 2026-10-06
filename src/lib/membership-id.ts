import { MEMBERSHIP_ID_PREFIX, MEMBERSHIP_ID_SEQUENCE_LENGTH } from "@/lib/constants";

/**
 * The membership ID *format*, kept separate from the service that mints them.
 *
 * `lib/services/membership.ts` is `server-only` — it increments a counter document in
 * Mongo. This module is not, and must not become: `lib/validators/members.ts` needs the
 * pattern to validate a form field, and that validator is pulled into client bundles by
 * the suspend dialog and the member forms.
 *
 * That is not a theoretical concern. Importing the format check from the service once
 * dragged `mongoose` through `validators/members.ts` into the browser bundle, and
 * `next build` failed with *"`server-only` cannot be imported from a Client Component"*
 * while `tsc` and `eslint` both passed clean — the mistake was invisible until the
 * bundler traced it.
 *
 * So: **generation lives in the service, the format lives here, and the service imports
 * this.** One definition of the shape, importable from either side.
 */

/**
 * Anchored pattern for `LIB-<year>-<4-digit-sequence>`, e.g. `LIB-2026-0042`.
 *
 * Built from the same constants the generator uses, so changing
 * `MEMBERSHIP_ID_SEQUENCE_LENGTH` cannot leave a stale regex behind that would reject
 * every id the service starts minting.
 *
 * `u` is set deliberately: without it the engine accepts legacy escape forms, and
 * `\d` matching non-ASCII digits is exactly the kind of loose acceptance that lets a
 * homoglyph through a search box.
 */
export const MEMBERSHIP_ID_PATTERN = new RegExp(
  `^${MEMBERSHIP_ID_PREFIX}-\\d{4}-\\d{${MEMBERSHIP_ID_SEQUENCE_LENGTH}}$`,
  "u",
);

/** Type guard for a membership ID, used by the server and by client-side validation. */
export function isValidMembershipId(value: string): boolean {
  return MEMBERSHIP_ID_PATTERN.test(value);
}