import { Schema, model, models, type Model } from "mongoose";
import type { ReviewDoc } from "@/types";

const ReviewSchema = new Schema<ReviewDoc>(
  {
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    member: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
      validate: { validator: Number.isInteger, message: "Rating must be a whole number" },
    },
    comment: { type: String, default: null, trim: true, maxlength: 1000 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Business rule 9: a member reviews a book once; edits update the same row.
ReviewSchema.index({ book: 1, member: 1 }, { name: "review_one_per_member_book", unique: true });

export type ReviewModel = Model<ReviewDoc>;

export const Review: Model<ReviewDoc> =
  (models.Review as Model<ReviewDoc>) ?? model<ReviewDoc>("Review", ReviewSchema);
