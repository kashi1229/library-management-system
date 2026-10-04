import { Schema, model, models, type Model } from "mongoose";
import { BOOK_STATUSES, type BookStatus } from "@/lib/constants";
import type { BookDoc } from "@/types";

const CoverSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const BookSchema = new Schema<BookDoc>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [1, "Title is required"],
      maxlength: [300, "Title must be 300 characters or fewer"],
      index: true,
    },
    /** From title + short id suffix, so two books with the same title differ. */
    slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
    authors: {
      type: [{ type: String, trim: true }],
      required: true,
      validate: {
        validator: (authors: string[]) => Array.isArray(authors) && authors.length > 0,
        message: "At least one author is required",
      },
      index: true,
    },
    /** Stored normalised: digits and X only, no hyphens. */
    isbn: { type: String, default: null, unique: true, sparse: true, trim: true, uppercase: true },
    publisher: { type: String, default: null, trim: true, maxlength: 200 },
    edition: { type: String, default: null, trim: true, maxlength: 80 },
    publishedYear: {
      type: Number,
      default: null,
      min: [1000, "Year must be 1000 or later"],
      max: [new Date().getFullYear() + 1, "Year is in the future"],
    },
    language: { type: String, default: "English", trim: true, maxlength: 60, index: true },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },
    /** Lowercased for consistent filtering. */
    tags: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [],
      index: true,
    },
    description: { type: String, default: null, trim: true, maxlength: 2000 },
    pageCount: { type: Number, default: null, min: [1, "Page count must be positive"] },
    cover: { type: CoverSchema, default: null },
    shelfLocation: { type: String, default: null, trim: true, maxlength: 40 },
    totalCopies: {
      type: Number,
      required: true,
      min: [1, "A book needs at least one copy"],
      validate: {
        validator: Number.isInteger,
        message: "Total copies must be a whole number",
      },
    },
    /**
     * System-managed. Only circulation services (issue/return) and total-copy
     * edits write it — never a generic update endpoint (invariant 6).
     */
    availableCopies: {
      type: Number,
      required: true,
      min: [0, "Available copies cannot be negative"],
    },
    status: { type: String, enum: BOOK_STATUSES, default: "active", index: true },
    /** Derived from reviews; maintained by the review service. */
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    borrowCount: { type: Number, default: 0, min: 0, index: true },
    addedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

// Weighted text search: title 5, isbn 4, authors 3, tags 2 (data-model.md).
BookSchema.index(
  { title: "text", authors: "text", tags: "text", isbn: "text" },
  {
    name: "book_text_search",
    weights: { title: 5, isbn: 4, authors: 3, tags: 2 },
  },
);

// Compound index for the most common staff + public catalog queries.
BookSchema.index({ status: 1, category: 1, createdAt: -1 }, { name: "book_status_category" });

/**
 * Invariant 5: `availableCopies` must never exceed `totalCopies`. The
 * circulation service is the authoritative guard; this hook is the last line of
 * defence so an incorrect write can never reach the collection.
 */
BookSchema.pre("validate", async function () {
  const available = this.availableCopies;
  const total = this.totalCopies;

  if (typeof available === "number" && typeof total === "number") {
    if (available > total) throw new Error("Available copies cannot exceed total copies");
    if (available < 0) throw new Error("Available copies cannot be negative");
  }
});

export type BookModel = Model<BookDoc>;

export const Book: Model<BookDoc> =
  (models.Book as Model<BookDoc>) ?? model<BookDoc>("Book", BookSchema);

export type { BookStatus };
