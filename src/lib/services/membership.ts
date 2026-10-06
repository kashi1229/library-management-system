import "server-only";
import { Counter } from "@/models";
import { MEMBERSHIP_ID_PREFIX, MEMBERSHIP_ID_SEQUENCE_LENGTH } from "@/lib/constants";

/**
 * Membership ID *generation*: `LIB-<year>-<4-digit-sequence>` (e.g. `LIB-2026-0042`).
 *
 * `findOneAndUpdate` with `$inc` + `upsert` is a single atomic document update,
 * so concurrent registrations can never collide — the sequence restarts each
 * calendar year via a separate counter document.
 *
 * The *format* check lives in `lib/membership-id.ts`, not here. This file is
 * `server-only`, and the validator and client forms need the same pattern; keeping the
 * regex here would put mongoose in the browser bundle.
 */

/** Returns the next sequential membership ID, unique across concurrent calls. */
export async function nextMembershipId(now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const counterId = `membership-${year}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean<{ seq: number }>();

  if (!counter) {
    throw new Error(`Could not increment the ${counterId} sequence.`);
  }

  const sequence = String(counter.seq).padStart(MEMBERSHIP_ID_SEQUENCE_LENGTH, "0");
  return `${MEMBERSHIP_ID_PREFIX}-${year}-${sequence}`;
}
