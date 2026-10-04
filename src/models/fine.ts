import { Schema, model, models, type Model } from "mongoose";
import { FINE_STATUSES, PAYMENT_METHODS, type FineStatus, type PaymentMethod } from "@/lib/constants";
import type { FineDoc } from "@/types";

const FineSchema = new Schema<FineDoc>(
  {
    /** One fine per loan — a loan can only be returned late once. */
    loan: { type: Schema.Types.ObjectId, ref: "Loan", required: true, unique: true },
    member: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    daysOverdue: { type: Number, required: true, min: 0 },
    /** Snapshot of the policy rate at the moment the fine was created. */
    ratePerDay: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    /** unpaid → paid | waived. Terminal states cannot change. */
    status: { type: String, enum: FINE_STATUSES, default: "unpaid", index: true },
    paidAt: { type: Date, default: null },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: null },
    waivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: null, trim: true, maxlength: 500 },
    note: { type: String, default: null, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

export type FineModel = Model<FineDoc>;

export const Fine: Model<FineDoc> =
  (models.Fine as Model<FineDoc>) ?? model<FineDoc>("Fine", FineSchema);

export type { FineStatus, PaymentMethod };
