import { Schema, model, models, type Model } from "mongoose";
import type { WishlistDoc } from "@/types";

const WishlistSchema = new Schema<WishlistDoc>(
  {
    member: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    book: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  },
);

// Saving the same book twice is a no-op error at the database level.
WishlistSchema.index({ member: 1, book: 1 }, { name: "wishlist_unique", unique: true });

export type WishlistModel = Model<WishlistDoc>;

export const Wishlist: Model<WishlistDoc> =
  (models.Wishlist as Model<WishlistDoc>) ?? model<WishlistDoc>("Wishlist", WishlistSchema);
