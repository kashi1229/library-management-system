import { Schema, model, models, type Model } from "mongoose";
import { LOAN_STATUSES, type LoanStatus } from "@/lib/constants";
import type { LoanDoc } from "@/types";

const LoanSchema = new Schema<LoanDoc>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    issuedAt: { type: Date, required: true, default: () => new Date() },
    /** Derived from the Settings singleton at issue time. */
    dueDate: { type: Date, required: true, index: true },
    returnedAt: { type: Date, default: null },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    renewCount: { type: Number, default: 0, min: 0 },
    /** Overdue is *derived* (`active` + past dueDate), never stored. */
    status: { type: String, enum: LOAN_STATUSES, default: "active", index: true },
    /** Denormalised so loan lists never need to join the fine. */
    fineAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: null, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

LoanSchema.index({ member: 1, status: 1 }, { name: "loan_member_status" });
LoanSchema.index({ book: 1, status: 1 }, { name: "loan_book_status" });

/**
 * Hard database guarantee for business rule 1: a member can never hold two
 * active loans of the same book. Duplicate-key errors surface as a clear
 * conflict in the circulation service rather than a race-condition bug.
 */
LoanSchema.index(
  { book: 1, member: 1 },
  {
    name: "loan_one_active_per_member_book",
    unique: true,
    partialFilterExpression: { status: "active" },
  },
);

export type LoanModel = Model<LoanDoc>;

export const Loan: Model<LoanDoc> =
  (models.Loan as Model<LoanDoc>) ?? model<LoanDoc>("Loan", LoanSchema);

export type { LoanStatus };
