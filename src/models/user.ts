import { Schema, model, models, type Model, type Types } from "mongoose";
import { ROLES, USER_STATUSES, type Role, type UserStatus } from "@/lib/constants";
import type { UserDoc } from "@/types";

/** Cloudinary avatar shape. The bytes live in Cloudinary, not here. */
const AvatarSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const UserSchema = new Schema<UserDoc>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name must be 80 characters or fewer"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      // Never returns in a query unless explicitly asked for.
      select: false,
    },
    role: { type: String, enum: ROLES, default: "member", index: true },
    /**
     * Members only. **No `default: null`** — a `sparse` unique index skips documents
     * where the field is absent, but a stored `null` counts as a value. With a
     * default, every staff account (librarian, admin) would collide on
     * `membershipId_1` and the second one ever created would fail with a bare
     * `E11000`. Staff records must omit the key entirely, exactly as
     * `data-model.md` documents; reads use `user.membershipId ?? null`.
     */
    membershipId: { type: String, unique: true, sparse: true, trim: true },
    phone: { type: String, default: null, trim: true, maxlength: 32 },
    department: { type: String, default: null, trim: true, maxlength: 120 },
    avatar: { type: AvatarSchema, default: null },
    status: { type: String, enum: USER_STATUSES, default: "active", index: true },
    suspendedReason: { type: String, default: null, trim: true, maxlength: 500 },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        // Invariant: credentials never leave the server.
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: { virtuals: true, versionKey: false },
  },
);

/** Population helper used when a book or loan needs its member details. */
export function populateMember(
  select = "name email membershipId avatar role status",
): Record<string, unknown> {
  return { path: "member", select };
}

export type UserModel = Model<UserDoc> & {
  hashPassword?: never;
};

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", UserSchema);

export type { Role, UserStatus };
export type UserId = Types.ObjectId;
