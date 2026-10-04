import { z } from "zod";
import { cloudinaryImageSchema } from "@/lib/validators/upload";

/**
 * Profile update schema.
 *
 * Email, membership ID, role and status are **deliberately absent** — they are
 * read-only (F2) and must never be writable from the client. A zod object
 * strips unknown keys by default, so even a crafted payload cannot set them.
 *
 * Department is free text rather than an enum: the select offers common
 * departments as suggestions, but a university may have many more.
 */

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be 80 characters or fewer"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?\d{7,15}$/, "Enter a valid phone number (7–15 digits)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  department: z
    .string()
    .trim()
    .max(120, "Department must be 120 characters or fewer")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * `null` explicitly removes the avatar. Omitting the key leaves it unchanged,
   * which is what lets the details form save without touching the avatar.
   */
  avatar: cloudinaryImageSchema.nullish(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
