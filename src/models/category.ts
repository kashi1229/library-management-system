import { Schema, model, models, type Model } from "mongoose";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_ICON, type CategoryColor } from "@/lib/constants";
import type { CategoryDoc } from "@/types";

const CategorySchema = new Schema<CategoryDoc>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name must be 60 characters or fewer"],
    },
    // Generated from the name; unique so public URLs stay predictable.
    slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    description: { type: String, default: null, trim: true, maxlength: 500 },
    /** Lucide icon name string, resolved to a component in the UI layer. */
    icon: { type: String, default: DEFAULT_CATEGORY_ICON, trim: true, maxlength: 60 },
    color: { type: String, enum: CATEGORY_COLORS, default: "forest" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

export type CategoryModel = Model<CategoryDoc>;

export const Category: Model<CategoryDoc> =
  (models.Category as Model<CategoryDoc>) ?? model<CategoryDoc>("Category", CategorySchema);

export type { CategoryColor };
