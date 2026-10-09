import "server-only";
import { Types } from "mongoose";
import { Book, Loan, Setting } from "@/models";
import { buildDedupeKey, notify } from "@/lib/services/notifications";
import { expireStaleReservations } from "@/lib/services/reservations";
import { logAudit } from "@/lib/services/audit";
import { differenceInCalendarDays, format } from "date-fns";
import type { Actor } from "@/types";

/**
 * The maintenance job (spec 16).
 *
 * **Idempotent by construction, not by hope.** Every notification it writes carries a
 * `dedupeKey` of `type:id:YYYY-MM-DD`, and that key is a **unique sparse index** on the model.
 * Running the job five times in one afternoon therefore produces five attempts at the same
 * fourteen keys and exactly five successes; the other attempts hit the index and are swallowed
 * by `notify`. Without that, a job that runs every ten minutes would send a member a fresh
 * "this book is overdue" every ten minutes for as long as they kept it.
 *
 * **The date in the key is the day, not the run.** The throttle in the spec is ten minutes, so
 * the key cannot be the timestamp — it would be unique every run and the index would do
 * nothing. `buildDedupeKey` uses the UTC calendar date, which is also what
 * `differenceInCalendarDays` is measured in (invariant 12), so a loan is "overdue today"
 * according to both halves of the comparison.
 *
 * **What it does, in order:**
 * 1. expires `ready` holds whose window has passed and promotes the queue behind them
 * 2. warns about loans due within `dueSoonDays`
 * 3. warns about loans already past their due date
 *
 * The expiry comes first because it releases copies; a member told a book is due soon while it
 * is actually sitting on a shelf with an expired hold on it has been told something already
 * untrue.
 */

export type MaintenanceCounts = {
  /** `ready` holds closed for running out of time, and the queue promoted behind them. */
  expiredReservations: number;
  /** Books a member still holds that are due within the warning window. */
  dueSoon: number;
  /** Books a member still holds that are already past their due date. */
  overdue: number;
  /**
   * True when another sweep held the throttle, so this run did nothing.
   *
   * Reported rather than swallowed: an admin who pressed the button needs to know the work was
   * already being done, and a silent zero reads as "there was nothing to do" — which is a very
   * different statement.
   */
  skipped?: boolean;
};

/**
 * How many days ahead a loan is warned about.
 *
 * Not a Setting — it is a property of "soon" in a 14-day loan rather than library policy, and
 * invariant 7 only covers policy *numbers* an admin may reasonably change. It is a named
 * constant so the answer to "why three?" is a grep rather than a hunt.
 */
export const DUE_SOON_DAYS = 3;

/** The throttle the spec asks for: one sweep per staff dashboard visit at most every 10 min. */
export const MAINTENANCE_THROTTLE_MS = 10 * 60 * 1000;

/**
 * Run the sweep and report what it did.
 *
 * **`actor` is required and must be a real person.** There is no `system` role: the earlier
 * units' `createFineIfLate` and reservation-expiry mistake was inventing one. When the cron
 * secret is used there is no user at all, so the route passes nothing and `logAudit` is skipped
 * — the `maintenance.run` row is written for an admin-initiated run, where there genuinely is
 * somebody to name.
 */
export async function runMaintenance(options: { actor?: Actor } = {}): Promise<MaintenanceCounts> {
  const now = new Date();

  /*
   * **Claim the throttle, do the work, and only then open any transaction.**
   *
   * The ordering is load-bearing, and getting it wrong cost this job its entire expiry step.
   * `promoteReservationQueue` calls `getSettings()`, which *upserts* the singleton — so it
   * writes to the `settings` document. With the claim written first and the expiry transaction
   * open afterwards, the two touch the same document inside one transaction and Mongo aborts it
   * with *"Transaction has been aborted"*. The job then 500ed and expired nothing, while
   * `tsc`, `eslint` and `next build` were all clean.
   *
   * Claiming first and keeping the claim out of every subsequent transaction is what makes the
   * overlap safe. See `claimRun` for why the claim is conditional rather than a plain write.
   */
  const claimed = await claimRun(now);
  if (!claimed) {
    // Another sweep holds the throttle and is doing the identical work. Not an error: the job
    // is idempotent, and reporting zeros to an admin who pressed the button is honest.
    return { expiredReservations: 0, dueSoon: 0, overdue: 0, skipped: true };
  }

  // Everything below runs one-at-a-time per process. See `runExclusive` for why the settings
  // claim alone does not stop two requests in the same Node process from overlapping.
  return runExclusive(async () => {
    // 1. Expiry + queue promotion. Its own transaction, in `reservations.ts`.
    const expiredReservations = await expireStaleReservations();

    const loans = await Loan.find({ status: "active" })
      .select("book member dueDate")
      .lean<Array<{ _id: Types.ObjectId; book: Types.ObjectId; member: Types.ObjectId; dueDate: Date }>>();

    const counts = { expiredReservations, dueSoon: 0, overdue: 0 };

    if (loans.length === 0) {
      await auditRun(options.actor, counts);
      return counts;
    }

    /*
     * Book titles are resolved in **one** `$in` query into a Map rather than a lookup per loan.
     * The whole point of the job is that it runs unattended every ten minutes, so the number of
     * queries it makes per run is a real cost and not a detail — a maintenance job that scales
     * its queries with the size of the lending collection is a job that gets turned off.
     */
    const bookIds = [...new Set(loans.map((loan) => String(loan.book)))];
    const titles = new Map<string, string>();
    const bookRows = await Book.find({ _id: { $in: bookIds.map((id) => new Types.ObjectId(id)) } })
      .select("title")
      .lean<Array<{ _id: Types.ObjectId; title: string }>>();
    for (const book of bookRows) titles.set(String(book._id), book.title);

    /*
     * **No transaction spans the notices.** Every write here is a self-contained insert guarded
     * by its own `dedupeKey`, and there is no multi-document invariant to protect: a member with
     * a due-soon notice but no overdue one for a moment is not a corruption, it is a sweep in
     * progress, and the next one completes it.
     *
     * A transaction here would be actively harmful. It would hold a write lock across every
     * member's notice for the length of the whole lending collection, and it would put the
     * notices and the reads that produced them into one snapshot — so a book returned during the
     * sweep could still be warned about as overdue, which is precisely the false notice the job
     * exists to avoid.
     */
    for (const loan of loans) {
      const daysLeft = differenceInCalendarDays(loan.dueDate, now);
      const title = titles.get(String(loan.book)) ?? "a book";

      if (daysLeft < 0) {
        const late = Math.abs(daysLeft);
        counts.overdue += 1;
        await notify({
          userId: loan.member,
          type: "overdue",
          title: late === 1 ? "A book is 1 day overdue" : `A book is ${late} days overdue`,
          message: `“${title}” was due on ${format(loan.dueDate, "d MMM yyyy")}. Please return it or renew it if you can.`,
          link: "/my-loans",
          dedupeKey: buildDedupeKey("overdue", loan._id, now),
        });
        continue;
      }

      if (daysLeft <= DUE_SOON_DAYS) {
        counts.dueSoon += 1;
        await notify({
          userId: loan.member,
          type: "due_soon",
          title: daysLeft === 0 ? "A book is due today" : `A book is due in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`,
          message: `“${title}” is due on ${format(loan.dueDate, "d MMM yyyy")}. You can renew it from My Loans if nobody is waiting.`,
          link: "/my-loans",
          dedupeKey: buildDedupeKey("due_soon", loan._id, now),
        });
      }
    }

    await auditRun(options.actor, counts);

    return counts;
  });
}

/**
 * Take the throttle, or report that somebody else already has it.
 *
 * **Claimed before the work, with a conditional update, and this is not a detail.**
 *
 * The first version stamped `lastMaintenanceAt` at the *end* of the run, which is the obvious
 * place for it and is a race. Two sweeps overlap in this app for entirely ordinary reasons: the
 * staff layout fires a throttled lazy sweep on **every** staff page load, and an admin can press
 * "Run maintenance" at that moment — or two librarian tabs can load together.
 *
 * There is a **second, subtler version of the same race** that only a conditional write to the
 * settings document cannot fix, and it is the one that actually bit: even with the claim
 * mutual, the two sweeps then run *concurrently*, both opening a transaction over the same
 * `reservations` rows. One expires a hold and promotes the queue; the other tries to expire the
 * same hold. Mongo rejects the loser with *"Transaction has been aborted"* or *"Write conflict
 * during plan execution"* — and because the abort surfaces as a thrown error, a librarian who
 * pressed "Run maintenance" saw a 500 and the job appeared broken.
 *
 * **The losers are made harmless rather than retried.** `expireStaleReservations` is
 * idempotent by construction — it only closes holds whose window has passed and only promotes
 * into genuinely free copies — so a sweep that finds nothing left to do is correct, not
 * partial. So the sweep is run under `runExclusive`, and a concurrent caller waits for the
 * in-flight run rather than starting a competing transaction.
 *
 * **The window is 15 minutes against a 10-minute throttle.** A run that starts at minute 9.9 and
 * ends at minute 10.1 must not leave the job unrunnable until minute 20, and claiming slightly
 * early costs at most one extra sweep. It also closes the window where two runs both read a
 * stamp that is about to expire.
 *
 * `returnDocument: "after"` rather than the deprecated `new: true`.
 */
async function claimRun(now: Date): Promise<boolean> {
  const claimWindow = new Date(now.getTime() - MAINTENANCE_THROTTLE_MS - 5 * 60_000);

  const updated = await Setting.findOneAndUpdate(
    {
      key: "global",
      $or: [{ lastMaintenanceAt: null }, { lastMaintenanceAt: { $lt: claimWindow } }],
    },
    { $set: { lastMaintenanceAt: now } },
    { returnDocument: "after" },
  ).select("_id");

  return updated !== null;
}

/**
 * Serialise maintenance against itself, in this process.
 *
 * **A module-level promise chain, so a second caller waits rather than racing.** The throttle in
 * `Settings` stops two *machines* running this twice; it cannot stop two requests inside one
 * Node process, and both of those happen constantly here — the staff layout fires on every page
 * load, so two tabs or a fast double-navigation overlap regularly.
 *
 * The claim already excludes the second caller from *starting work*, but the two can still
 * overlap when the first is between its claim and its expiry transaction. Holding a promise here
 * and releasing it in `finally` means the second request waits for the first to finish and then
 * sees a clean, idempotent, already-finished job.
 *
 * **Deliberately in-process and therefore honest about its limits.** A multi-instance deployment
 * is protected by the `Settings` claim; this covers the single-instance case this app runs. Both
 * are needed, and neither alone is sufficient — which is worth writing down, because "it has a
 * throttle" sounds like the whole story and is not.
 */
let inFlight: Promise<unknown> = Promise.resolve();

function runExclusive<T>(work: () => Promise<T>): Promise<T> {
  const result = inFlight.then(work, work);
  // The chain itself must never reject, or every later caller inherits the failure.
  inFlight = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Record who ran the sweep.
 *
 * **The `Setting` id is read back, never derived from its key.** `logAudit` coerces a string
 * `entityId` with `new Types.ObjectId(...)`, and `new Types.ObjectId("global")` **throws** — so
 * passing the key as the id meant the entry was swallowed by `logAudit`'s own catch and the
 * maintenance run was **never recorded at all**, with only a server log to show for it. A
 * maintenance run is the one action in this app that moves copies and writes notices to members
 * with no person behind it, so its absence from the audit trail is exactly the kind of silence
 * that should not be possible.
 *
 * **No actor means no row.** When the cron secret was used there is no user, and inventing a
 * "system" actor is the mistake Units 13 and 14 made on the automatic fine and the automatic
 * hold expiry. The clock did it.
 */
async function auditRun(actor: Actor | undefined, counts: MaintenanceCounts): Promise<void> {
  if (!actor) return;

  const setting = await Setting.findOne({ key: "global" })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();

  await logAudit({
    actor,
    action: "maintenance.run",
    entityType: "Setting",
    entityId: setting?._id ?? new Types.ObjectId(),
    summary: `Maintenance: ${counts.expiredReservations} expired, ${counts.dueSoon} due soon, ${counts.overdue} overdue`,
    meta: { ...counts },
  });
}

/**
 * Whether a sweep is due, from `Settings.lastMaintenanceAt`.
 *
 * **Reads the setting directly rather than calling `getSettings()`**, which caches for thirty
 * seconds: the throttle is asking "has it been ten minutes", and a value that may be up to half
 * a minute stale answers that question wrongly at exactly the boundary — a dashboard visited
 * just after a run would trigger a second sweep that `lastMaintenanceAt` says is unnecessary.
 */
export async function isMaintenanceDue(now = new Date()): Promise<boolean> {
  const setting = await Setting.findOne({ key: "global" }).select("lastMaintenanceAt").lean<{
    lastMaintenanceAt?: Date | null;
  }>();

  if (!setting?.lastMaintenanceAt) return true;

  return now.getTime() - new Date(setting.lastMaintenanceAt).getTime() >= MAINTENANCE_THROTTLE_MS;
}

/**
 * Run the sweep if it is due, swallowing failures.
 *
 * Called from a layout, so it must never be able to fail a page render: a member opening the
 * dashboard does not care whether the sweep worked, and turning a background job into a 500
 * is how background jobs get removed. The failure is logged, not swallowed.
 */
export async function runMaintenanceIfDue(): Promise<void> {
  try {
    if (!(await isMaintenanceDue())) return;
    await runMaintenance();
  } catch (error) {
    console.error("[maintenance] throttled sweep failed", error);
  }
}
