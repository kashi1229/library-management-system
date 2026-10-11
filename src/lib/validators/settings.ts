import { z } from "zod";

/**
 * Settings schemas (Unit 19).
 *
 * Enforces policy limits per `context/specs/19-settings.md`:
 * - Library name: 1-80 chars
 * - Contact email: valid email or empty/null
 * - Loan period: 1–90 days
 * - Max active loans: 1–20
 * - Max renewals: 0–10
 * - Renewal extension: 1–30 days
 * - Fine per day: 0–1000
 * - Max fine per loan: must be >= fine per day
 * - Fine block threshold: >= 0
 * - Reservation hold hours: 1–240 hours
 * - Max reservations per member: 1–10
 * - Currency code: 3 uppercase letters (e.g. USD, EUR, GBP)
 * - Currency symbol: 1-4 chars (e.g. $, £, €, Rs)
 */

export const updateSettingsSchema = z
  .object({
    libraryName: z
      .string()
      .trim()
      .min(1, "Library name is required.")
      .max(80, "Library name must be 80 characters or fewer.")
      .optional(),
    contactEmail: z
      .string()
      .trim()
      .email("Please provide a valid contact email.")
      .max(160)
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    loanPeriodDays: z
      .number()
      .int("Loan period must be whole days.")
      .min(1, "Loan period must be at least 1 day.")
      .max(90, "Loan period cannot exceed 90 days.")
      .optional(),
    maxActiveLoans: z
      .number()
      .int()
      .min(1, "Members must be allowed at least 1 active loan.")
      .max(20, "Maximum active loans cannot exceed 20.")
      .optional(),
    maxRenewals: z
      .number()
      .int()
      .min(0, "Renewals cannot be negative.")
      .max(10, "Maximum renewals cannot exceed 10.")
      .optional(),
    renewalExtensionDays: z
      .number()
      .int()
      .min(1, "Renewal extension must be at least 1 day.")
      .max(30, "Renewal extension cannot exceed 30 days.")
      .optional(),
    finePerDay: z
      .number()
      .min(0, "Fine cannot be negative.")
      .max(1000, "Fine per day cannot exceed 1,000.")
      .optional(),
    maxFinePerLoan: z
      .number()
      .min(0, "Max fine cannot be negative.")
      .max(100_000, "Max fine cannot exceed 100,000.")
      .optional(),
    fineBlockThreshold: z
      .number()
      .min(0, "Fine block threshold cannot be negative.")
      .max(100_000, "Fine block threshold cannot exceed 100,000.")
      .optional(),
    reservationHoldHours: z
      .number()
      .int()
      .min(1, "Hold window must be at least 1 hour.")
      .max(240, "Hold window cannot exceed 240 hours (10 days).")
      .optional(),
    maxReservationsPerMember: z
      .number()
      .int()
      .min(1, "Members must be allowed at least 1 reservation.")
      .max(10, "Max reservations cannot exceed 10.")
      .optional(),
    currencyCode: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, "Currency code must be 3 letters.")
      .max(3, "Currency code must be 3 letters.")
      .regex(/^[A-Z]{3}$/, "Currency code must be 3 letters (e.g. USD).")
      .optional(),
    currencySymbol: z
      .string()
      .trim()
      .min(1, "Currency symbol is required.")
      .max(4, "Currency symbol must be 4 characters or fewer.")
      .optional(),
  })
  .refine(
    (data) => {
      if (
        data.maxFinePerLoan !== undefined &&
        data.finePerDay !== undefined &&
        data.maxFinePerLoan < data.finePerDay
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Maximum fine per loan must be greater than or equal to the daily fine rate.",
      path: ["maxFinePerLoan"],
    },
  );

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
