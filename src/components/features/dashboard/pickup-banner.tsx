import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import type { MemberDashboard } from "@/types";

type Pickup = MemberDashboard["pickups"][number];

/**
 * "Your books are ready for pickup" — the one thing on this page that is time-critical.
 *
 * **It is above the fold and above everything else, and it is a banner rather than a card.**
 * A hold has a window (`reservationHoldHours`), so the member who needs to act on this is the
 * one most likely to be looking at the wrong row. A `role="status"` announcement means it is
 * also the first thing a screen-reader user hears after the greeting.
 *
 * **`hoursLeft` comes from the server's `hoursUntil`, rounded up.** Recomputing it in the
 * browser from `expiresAt` would be a second rounding rule, and two rounding rules is how a
 * count-down starts disagreeing with itself (Unit 14).
 */
export function PickupBanner({ pickups }: { pickups: MemberDashboard["pickups"] }) {
  if (pickups.length === 0) return null;

  const soonest = soonestHold(pickups);
  const urgent = soonest !== null && soonest.hoursLeft !== null && soonest.hoursLeft <= 4;

  return (
    <section
      role="status"
      className={`rounded-lg border px-5 py-4 ${
        urgent ? "border-warning/40 bg-warning-soft" : "border-success/40 bg-success-soft"
      }`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span
          aria-hidden="true"
          className={`grid size-9 shrink-0 place-items-center rounded-md ${
            urgent ? "bg-warning-soft text-warning-ink" : "bg-success-soft text-success-ink"
          }`}
        >
          <PackageCheck className="size-5" strokeWidth={1.75} />
        </span>

        <div className="min-w-0 flex-1">
          <h2
            className={`font-display text-h3 font-semibold tracking-[-0.02em] ${
              urgent ? "text-warning-ink" : "text-success-ink"
            }`}
          >
            {pickups.length === 1 ? "A book is ready for you" : `${pickups.length} books are ready for you`}
          </h2>
          <p className={`mt-1 text-small ${urgent ? "text-warning-ink" : "text-success-ink"}`}>
            {/* One sentence naming the deadline, because "ready" on its own does not tell the
                reader whether to walk over today or next week. */}
            {urgent
              ? `Collect ${soonest!.book.title} within ${soonest!.hoursLeft} ${
                  soonest!.hoursLeft === 1 ? "hour" : "hours"
                } or it goes to the next reader.`
              : `A copy is being held at the desk${soonest?.hoursLeft ? ` for ${soonest.hoursLeft} ${
                  soonest.hoursLeft === 1 ? "hour" : "hours"
                } more` : ""}.`}
          </p>

          {/* More than one hold: name the rest rather than hiding them. A banner listing "and
              one more" makes the reader open another screen to find out which. */}
          {pickups.length > 1 ? (
            <ul className="mt-2 space-y-0.5">
              {pickups.slice(1, 4).map((pickup) => (
                <li key={pickup.id} className="truncate text-small text-muted-foreground">
                  {pickup.book.title}
                </li>
              ))}
              {pickups.length > 4 ? (
                <li className="text-small text-muted-foreground">
                  and {pickups.length - 4} more
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <Link
          href={ROUTES.member.loans}
          className="shrink-0 self-center text-small font-medium text-primary underline-offset-4 hover:underline"
        >
          See details
        </Link>
      </div>
    </section>
  );
}

/**
 * The hold with the least time left.
 *
 * **`hoursLeft === null` sorts last, not first.** A hold with no `expiresAt` is a malformed row
 * and must not become the banner's headline — but it also must not make the comparison `NaN` and
 * silently return nothing at all, which is what a bare `Math.min(...array)` would do.
 */
function soonestHold(pickups: MemberDashboard["pickups"]): Pickup | null {
  let soonest: Pickup | null = null;

  for (const pickup of pickups) {
    if (pickup.hoursLeft === null) continue;
    if (soonest === null || soonest.hoursLeft === null || pickup.hoursLeft < soonest.hoursLeft) {
      soonest = pickup;
    }
  }

  return soonest ?? pickups[0] ?? null;
}