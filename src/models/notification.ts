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
     */
    dedupeKey: { type: String, default: null, unique: true, sparse: true, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Drives the notifications page: unread first, newest first.
NotificationSchema.index({ user: 1, readAt: 1, createdAt: -1 }, { name: "notification_inbox" });

export type NotificationModel = Model<NotificationDoc>;

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ??
  model<NotificationDoc>("Notification", NotificationSchema);

export type { NotificationType };
