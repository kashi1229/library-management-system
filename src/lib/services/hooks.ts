import "server-only";
import { Reservation } from "@/models";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import type { ClientSession, Types } from "mongoose";

/**
 * Cross-unit seams for circulation (spec 11 §Stub contract file).
 *
 * `circulation.ts` calls these at exactly the points where the unit that owns the
 * behaviour plugs in. **They exist so the call sites are final and stable**: when Unit 14
 * lands, the work is filling in a function body here rather than restructuring a
 * transaction, which is the part that is genuinely expensive to get wrong.
 *
 * | Hook | Owner | Behaviour today |
 * |---|---|---|
 * | `createFineIfLate` | **Unit 13** ✅ | **done — now in `services/fines.ts`** |
 * | `promoteReservationQueue` | **Unit 14** | no-op |
 * | `fulfilReadyReservationIfAny` | **Unit 14** | no-op, reports that nothing was fulfilled |
 * | `countOtherReservations` | — | **real**, see below |
 *
 * `withTransaction` is the reason these take a `session`: the caller is already inside a
 * transaction, and a hook that opened its own connection would write outside it.
 *
 * `createFineIfLate` used to live here as a stub. It has moved to `services/fines.ts`,
 * because it is no longer a placeholder — and leaving a stub beside a real implementation
 * would invite someone to call the wrong one.
 */

/**
 * Offer the freed copy to the next member in the queue. **Unit 14 owns the queue.**
 *
 * Called after every return, because a returned copy is the only event that can make a
 * waiting reservation ready (business rule 6).
 */
export async function promoteReservationQueue(
  _bookId: Types.ObjectId,
  _session: ClientSession,
): Promise<void> {
  // Unit 14: find the oldest `waiting` reservation when a copy is free, set
  // `readyAt`/`expiresAt` from `reservationHoldHours`, and notify the member.
}

/**
 * Consume the member's own ready hold when their book is issued. **Unit 14 owns holds.**
 *
 * Business rule 1: if the member has a `ready` reservation for this book, issuing the
 * book *is* that hold being collected, so the reservation must end up `fulfilled` and
 * linked to the loan rather than left dangling as a hold on a book they now have.
 *
 * Returns whether a hold was consumed, so the caller can report it.
 */
export async function fulfilReadyReservationIfAny(
  _memberId: Types.ObjectId,
  _bookId: Types.ObjectId,
  _loanId: Types.ObjectId,
  _session: ClientSession,
): Promise<boolean> {
  // Unit 14.
  return false;
}

/**
 * Live reservations **by other members** on a book, for the renewal rule.
 *
 * **Implemented for real, deliberately.** The spec calls this a stub, but a stub that
 * returned `0` would let a renewal through on exactly the book other members are queuing
 * for — silently breaking business rule 3, which blocks renewal when anyone is waiting.
 * A stub is only safe when its "no data" answer happens to be the permissive one, and
 * here the permissive answer is the wrong one.
 *
 * The `Reservation` collection and its `{ book, status }` indexes have existed since
 * Unit 02, so this is a plain indexed count rather than a guess. What Unit 14 owns is the
 * *queue* — promotion, expiry, cancellation — not this existence check.
 *
 * `exceptMemberId` is the loan's own member: **their own hold must not block their own
 * renewal**, otherwise a member who reserved and then collected a book could never renew
 * it.
 */
export async function countOtherReservations(
  bookId: Types.ObjectId,
  exceptMemberId: Types.ObjectId,
  session: ClientSession,
): Promise<number> {
  return Reservation.countDocuments(
    {
      book: bookId,
      member: { $ne: exceptMemberId },
      status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
    },
    { session },
  );
}