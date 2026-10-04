import { Schema, model, models, type Model } from "mongoose";
import type { SettingDoc } from "@/types";

/**
 * Library policy singleton (`key: "global"`).
 *
 * Every business-rule threshold in `architecture.md` is read from here at
 * runtime — never hard-coded (invariant 7). Field defaults below are the seed
 * values and the validation ranges are enforced by the settings service.
 */
const SettingSchema = new Schema<SettingDoc>(
  {
    key: { type: String, default: "global", required: true, unique: true, immutable: true },
    libraryName: { type: String, default: "Athenaeum", required: true, trim: true, maxlength: 80 },
    contactEmail: { type: String, default: null, trim: true, lowercase: true, maxlength: 160 },

    // --- Circulation policy ---------------------------------------------
    loanPeriodDays: { type: Number, default: 14, min: 1, max: 365 },
    maxActiveLoans: { type: Number, default: 5, min: 1, max: 50 },
    maxRenewals: { type: Number, default: 2, min: 0, max: 10 },
    renewalExtensionDays: { type: Number, default: 7, min: 1, max: 90 },

    // --- Fines ----------------------------------------------------------
    finePerDay: { type: Number, default: 5, min: 0, max: 1000 },
    maxFinePerLoan: { type: Number, default: 250, min: 0, max: 100_000 },
    /** Members above this outstanding total cannot be issued new books. */
    fineBlockThreshold: { type: Number, default: 100, min: 0, max: 100_000 },

    // --- Reservations ---------------------------------------------------
    reservationHoldHours: { type: Number, default: 48, min: 1, max: 720 },
    maxReservationsPerMember: { type: Number, default: 3, min: 1, max: 20 },

    // --- Presentation ---------------------------------------------------
    currencyCode: { type: String, default: "USD", required: true, trim: true, uppercase: true, maxlength: 3 },
    currencySymbol: { type: String, default: "$", required: true, trim: true, maxlength: 4 },

    /** Throttles the lazy maintenance run triggered by staff dashboard loads. */
    lastMaintenanceAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

export type SettingModel = Model<SettingDoc>;

export const Setting: Model<SettingDoc> =
  (models.Setting as Model<SettingDoc>) ?? model<SettingDoc>("Setting", SettingSchema);
