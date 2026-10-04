import { Schema, model, models, type Model } from "mongoose";
import { RESERVATION_STATUSES, type ReservationStatus } from "@/lib/constants";
import type { ReservationDoc } from "@/types";

const ReservationSchema = new Schema<ReservationDoc>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: RESERVATION_STATUSES, default: "waiting", index: true },
    /** Set when the queue promotes this reservation to `ready`. */
    readyAt: { type: Date, default: null },
    /** `readyAt + reservationHoldHours`; expiry returns the copy to the shelf. */
    expiresAt: { type: Date, default: null },
    fulfilledLoan: { type: Schema.Types.ObjectId, ref: "Loan", default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

ReservationSchema.index({ book: 1, createdAt: 1 }, { name: "reservation_fifo_queue" });

/**
 * Business rule 5: one live reservation per member per book. The partial filter
 * lets a member re-reserve after cancelling or expiring a previous hold.
 */
ReservationSchema.index(
  { book: 1, member: 1 },
  {
    name: "reservation_one_active_per_member_book",
    unique: true,
    partialFilterExpression: { status: { $in: ["waiting", "ready"] } },
  },
);

export type ReservationModel = Model<ReservationDoc>;

export const Reservation: Model<ReservationDoc> =
  (models.Reservation as Model<ReservationDoc>) ??
  model<ReservationDoc>("Reservation", ReservationSchema);

export type { ReservationStatus };
