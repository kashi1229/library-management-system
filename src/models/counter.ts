import { Schema, model, models, type Model } from "mongoose";

/**
 * Atomic sequence generator, e.g. `{ _id: "membership-2026", seq: 42 }`.
 *
 * `findOneAndUpdate` with `$inc` + `upsert` is a single atomic document update,
 * so concurrent callers can never receive the same number.
 */
const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

export type Counter = {
  _id: string;
  seq: number;
  createdAt: Date;
  updatedAt: Date;
};

export const Counter: Model<Counter> =
  (models.Counter as Model<Counter>) ?? model<Counter>("Counter", CounterSchema);
