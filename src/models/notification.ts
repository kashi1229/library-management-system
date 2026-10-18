import { Schema, model, models, type Model } from "mongoose";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/constants";
import type { NotificationDoc } from "@/types";

const NotificationSchema = new Schema<NotificationDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    /** In-app route the notification links to, e.g. `/my-loans`. */
    link: { type: String, default: null, trim: true, maxlength: 300 },
    readAt: { type: Date, default: null },
    /**
     * `type:id:YYYY-MM-DD`. Unique so the maintenance job can re-run all day
     * without creating duplicate due-soon / overdue notifications.
     *
     * **No `default: null`** — see below. `notify()` omits the key entirely when a
     * notification is a one-off, and this index has to be *sparse* to allow that.
     */
    dedupeKey: { type: String, unique: true, sparse: true, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Drives the notifications page: unread first, newest first.
NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 }, { name: "notification_inbox" });

/**
 * ## Why `dedupeKey` carries **no** `default`
 *
 * This field was the **last remaining** sparse-unique field in the app with a `default: null`,
 * and it broke every action in the product that produces a one-off notification.
 *
 * A `sparse` index skips documents where the field is **absent**. A stored `null` is a value,
 * so `default: null` made every notification that did not pass a key write `dedupeKey: null` —
 * and the unique index then permitted **exactly one of them in the entire collection**. The
 * second failed with `E11000 … dedupeKey_1 dup key: { dedupeKey: null }`.
 *
 * The damage was not confined to the notification. `notify()` runs **inside** the circulation
 * transactions, and MongoDB aborts a transaction on *any* write error, so the duplicate key
 * poisoned the whole unit of work: issue, return and queue promotion all failed with
 * `MongoServerError: Transaction with { txnNumber: N } has been aborted` (code 251), which is
 * what Unit 16 recorded as an unexplained maintenance defect. The notifications the app *did*
 * have were exclusively the maintenance ones, because those are the only writes that carry a
 * `dedupeKey`.
 *
 * This is the same rule already applied to `User.membershipId` and `Book.isbn`, for the same
 * reason — see `data-model.md`. The general form: **a sparse unique field must have no default**,
 * because the only value a default can safely supply is "absent", and Mongoose cannot express
 * "absent" as a default.
 *
 * A database that already collected `dedupeKey: null` documents still has them after this
 * change — Mongoose stops writing the key, it does not remove what is stored. `npm run seed`
 * unsets them.
 */
export type NotificationModel = Model<NotificationDoc>;

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ??
  model<NotificationDoc>("Notification", NotificationSchema);

export type { NotificationType };
