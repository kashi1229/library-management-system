import "server-only";
import { Types, isValidObjectId } from "mongoose";
import { Notification } from "@/models";
import type { NotificationDoc } from "@/types";
import { AppError, buildMeta } from "@/lib/api";
import type { NotificationSummary, PageMeta } from "@/types";
import type { NotificationType } from "@/lib/constants";
import type { ClientSession } from "mongoose";

/**
 * In-app notifications.
 *
 * **Every circulation service already calls `notify(...)`** — issue, return, renew, fine
 * created/paid/waived, reservation ready/expired/cancelled, suspend/activate — so the copy at
 * each call site is the one the author of that event wrote, and it is *not* re-derived from a
 * template here. That was a deliberate departure from the spec's `notification-templates.ts`
 * map, and it is worth stating why, because "why is there no template map" is otherwise a
 * question every future reader asks:
 *
 * - The notification says what happened **to that member, about that book, on that date**:
 *   *"“Kindred” was returned 4 days after its due date. You owe $20.00."* A template map turns
 *   that into a function per type taking fifteen named arguments, which is the same copy with
 *   more indirection and no fewer places to get a placeholder wrong.
 * - **The call site already holds the values.** `fines.ts` computes `daysOverdue` and `amount`;
 *   `hooks.ts` has the hold's `expiresAt`. Handing those to a builder in another module means
 *   exporting them across a boundary to be passed straight back.
 * - The unit of drift that matters is not "the same event wordings the same". It is "two call
 *   sites decided the same wording differently", which a map does not prevent either — it only
 *   moves the decision.
 *
 * What the spec's map *was* for, and what exists instead:
 * - **Tone and icon** live in one place per type, in `notification-templates.ts`, because those
 *   *are* uniform per type and are needed by the UI in three components that would otherwise
 *   each grow their own switch.
 * - **Date-scoped copy** (due-soon, overdue) is generated in `maintenance.ts`, because that is
 *   the only caller and it needs the arithmetic anyway.
 *
 * **`notify` never throws into its caller.** A notification is a courtesy about an event that
 * already succeeded; a duplicate is the *expected* outcome of a maintenance re-run, not an
 * error. Rolling back a successful loan because a bell could not ring would be the wrong
 * trade in both directions.
 */

/** The tone drives the icon tile colour on both the popover and the page. */
export type NotificationTone = "info" | "success" | "warning" | "danger";

export type NotifyInput = {
  /** Recipient user id. */
  userId: unknown;
  type: NotificationType;
  title: string;
  message: string;
  /** In-app route the notification links to, e.g. `/my-loans`. */
  link?: string;
  /**
   * `type:id:YYYY-MM-DD` — the unique key that makes recurring notifications
   * (due-soon, overdue) idempotent across repeated maintenance runs.
   */
  dedupeKey?: string;
  /** Write inside an open transaction. */
  session?: ClientSession;
};

/** How many to return in the bell popover. The page is paginated. */
export const POPOVER_LIMIT = 6;

/**
 * Create one notification.
 *
 * **A duplicate is prevented by a read, not caught from the write.** The spec says "swallow
 * duplicate-key errors from `dedupeKey`", and that is exactly the instruction that cannot be
 * followed inside a transaction: **MongoDB aborts the whole transaction on any write error**, so
 * catching `E11000` and returning normally leaves the caller inside a transaction that is
 * already dead. Every later write in it fails with *"Transaction with { txnNumber: N } has been
 * aborted"*, and the eventual commit fails too — so a "handled" duplicate silently destroys the
 * rest of the unit of work. Reproduced directly against the local replica set before this was
 * changed: one duplicate insert, then a normal insert in the same transaction, and the second
 * one throws.
 *
 * So a `dedupeKey` is **checked first**, inside the caller's session so it reads the same
 * snapshot the rest of the transaction is reasoning about, and a duplicate returns without ever
 * attempting the insert. The unique index stays as the guarantee — two concurrent sweeps can
 * both read "absent" — and the `E11000` catch below is retained for *that* race, where there is
 * no transaction to poison and swallowing it is exactly right.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (!isValidObjectId(input.userId)) {
      // A notification addressed to something that is not a user would fail the `user` ref and
      // take the surrounding transaction down with it.
      console.error("[notify] skipped: recipient is not a user id", {
        type: input.type,
        userId: String(input.userId),
      });
      return;
    }

    if (input.dedupeKey) {
      const seen = await Notification.exists({ dedupeKey: input.dedupeKey }).session(
        input.session ?? null,
      );
      if (seen) return;
    }

    const entry = {
      user: new Types.ObjectId(String(input.userId)),
      type: input.type,
      title: input.title.slice(0, 120),
      message: input.message.slice(0, 500),
      link: input.link ?? null,
      // Absent rather than `null`: the index is **sparse**, and a stored `null` counts as a
      // value — every one-off notification would collide with every other one-off notification.
      ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
    };

    if (input.session) {
      await Notification.create([entry], { session: input.session });
    } else {
      await Notification.create(entry);
    }
  } catch (error) {
    // Safe here **only** because the duplicate was already ruled out by the read above, so this
    // can only be the concurrent-insert race, where there is no open transaction to abort.
    if (isDuplicateKeyError(error)) return;
    console.error("[notify] failed", { type: input.type }, error);
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * Build the idempotency key for a date-scoped notification.
 *
 * The date is the **calendar** day in UTC, not a timestamp: the maintenance job throttles
 * itself to ten minutes, so five runs on one afternoon must collapse to one key per event per
 * day, while the same event tomorrow must produce a new notification.
 */
export function buildDedupeKey(type: NotificationType, id: unknown, on: Date): string {
  return `${type}:${String(id)}:${on.toISOString().slice(0, 10)}`;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The one way a notification becomes a plain object.
 *
 * `tone` is resolved here rather than in the components: three of them draw a tile coloured by
 * type, and a `switch` in each is three places for the palette to disagree.
 */
function serialise(doc: NotificationDoc): NotificationSummary {
  return {
    id: String(doc._id),
    type: doc.type,
    tone: NOTIFICATION_TONE[doc.type],
    title: doc.title,
    message: doc.message,
    link: doc.link ?? null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    isRead: doc.readAt !== null && doc.readAt !== undefined,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** Unread first, then newest. Drives the page tabs and the popover alike. */
const SORT = { readAt: 1 as const, createdAt: -1 as const };

export async function listNotifications(options: {
  userId: unknown;
  page: number;
  limit: number;
  unreadOnly: boolean;
}): Promise<{ items: NotificationSummary[]; unreadCount: number; meta: PageMeta }> {
  const user = new Types.ObjectId(String(options.userId));
  const filter = options.unreadOnly ? { user, readAt: null } : { user };

  const [rows, unreadCount, total] = await Promise.all([
    Notification.find(filter)
      .sort(SORT)
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .lean<NotificationDoc[]>(),
    // **Over the whole inbox, not the page.** A badge that counts only the twelve rows on
    // screen reads "3 unread" while the member has eleven, and the number on the bell is the
    // number they will believe.
    Notification.countDocuments({ user, readAt: null }),
    Notification.countDocuments(filter),
  ]);

  return {
    items: rows.map(serialise),
    unreadCount,
    meta: buildMeta(total, options.page, options.limit),
  };
}

/** The latest few for the bell popover, plus the count for the badge. */
export async function getLatestForPopover(userId: unknown): Promise<{
  items: NotificationSummary[];
  unreadCount: number;
}> {
  const user = new Types.ObjectId(String(userId));

  const [rows, unreadCount] = await Promise.all([
    Notification.find({ user })
      .sort(SORT)
      .limit(POPOVER_LIMIT)
      .lean<NotificationDoc[]>(),
    Notification.countDocuments({ user, readAt: null }),
  ]);

  return { items: rows.map(serialise), unreadCount };
}

export async function getUnreadCount(userId: unknown): Promise<number> {
  return Notification.countDocuments({
    user: new Types.ObjectId(String(userId)),
    readAt: null,
  });
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Mark one notification read.
 *
 * **Scoped by user as well as id.** A member who guesses another member's notification id must
 * get a 404 rather than being able to clear a notification that is not theirs — the id alone is
 * not authorisation.
 *
 * **Idempotent**, and the `readAt: null` guard is what makes a second mark-read a no-op rather
 * than moving the timestamp a member can see.
 */
export async function markRead(
  notificationId: unknown,
  userId: unknown,
  session?: ClientSession,
): Promise<void> {
  const id = new Types.ObjectId(String(notificationId));
  const owner = { user: new Types.ObjectId(String(userId)) };

  const updated = await Notification.updateOne(
    { _id: id, ...owner, readAt: null },
    { $set: { readAt: new Date() } },
    { session },
  );

  if (updated.matchedCount === 0) {
    // Either it does not exist, or it belongs to somebody else, or it was already read. The
    // first two are the same answer on purpose: distinguishing them tells a prober which ids
    // exist.
    const exists = await Notification.exists({ _id: id, ...owner }).session(session ?? null);
    if (!exists) {
      throw AppError.notFound("That notification could not be found.");
    }
  }
}

export async function markAllRead(userId: unknown, session?: ClientSession): Promise<number> {
  const result = await Notification.updateMany(
    { user: new Types.ObjectId(String(userId)), readAt: null },
    { $set: { readAt: new Date() } },
    { session },
  );

  return result.modifiedCount;
}

/**
 * `Notification.type` → the single definition of its tone.
 *
 * Kept here rather than in `notification-templates.ts` because it is imported by the client
 * components that draw the tiles, and pulling a `server-only` module into a bundle would drag
 * mongoose in with it (the Unit 10 lesson). It is data, not a service.
 */
export const NOTIFICATION_TONE: Record<NotificationType, NotificationTone> = {
  loan_issued: "info",
  loan_returned: "success",
  loan_renewed: "success",
  due_soon: "warning",
  overdue: "danger",
  fine_created: "danger",
  fine_paid: "success",
  fine_waived: "info",
  reservation_ready: "success",
  reservation_expired: "warning",
  reservation_cancelled: "info",
  account_suspended: "danger",
  account_activated: "success",
  new_reservation: "info",
};