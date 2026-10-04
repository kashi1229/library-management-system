import { z } from "zod";

/**
 * Auth request schemas.
 *
 * These are the single source of truth for request validation: the API routes
 * and the Unit 04 client forms share them, so client and server can never
 * disagree about what a valid password or email is.
 */

/** Min 8 chars, at least one letter and one number (F1). */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be 128 characters or fewer")
  .regex(/[A-Za-z]/, "Password must include at least one letter")
  .regex(/[0-9]/, "Password must include at least one number");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(160, "Email must be 160 characters or fewer")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

/** Optional phone: 7–15 digits, optionally a leading `+`. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?\d{7,15}$/, "Enter a valid phone number (7–15 digits)")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name must be 80 characters or fewer"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    phone: phoneSchema,
    department: z
      .string()
      .trim()
      .max(120, "Department must be 120 characters or fewer")
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  // Confirmed after transformation so `confirmPassword` is compared post-trim.
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password different from your current one",
    path: ["newPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Shared password rules for client-side hints and the API. */
export const PASSWORD_RULE_HINTS = [
  "At least 8 characters",
  "At least one letter",
  "At least one number",
] as const;
