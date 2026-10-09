import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * The shared secret an external scheduler presents to trigger maintenance.
 *
 * **Compared with `timingSafeEqual`, not `===`.** A plain string comparison returns as soon as
 * it finds a differing character, so the time it takes leaks how much of the guess was right —
 * and this value is a credential that runs the maintenance job against the database. The
 * comparison here is constant-time and never logs the secret, not even on failure: the refusal
 * says *which* check failed, never any part of the value.
 *
 * **Absent is not "allow".** With no `CRON_SECRET` configured this returns `false` and the
 * secret path is closed, leaving only the admin session. A deployment that has not been given a
 * secret must not accept any header as though it had — "unset means no check" is how an
 * unauthenticated maintenance endpoint gets deployed to production.
 *
 * **The length is compared first, and that is not a leak.** `timingSafeEqual` throws on a
 * length mismatch, so the early return is required for it to be callable — and the secret's
 * length is not the secret. The *contents* are still compared in time independent of where the
 * first difference falls.
 */
export function isValidCronSecret(provided: string | null): boolean {
  const expected = process.env.CRON_SECRET;

  if (!expected) return false;
  if (!provided) return false;

  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");

  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}