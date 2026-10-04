import "server-only";
import { Setting } from "@/models";
import type { Actor, SettingDoc } from "@/types";

/**
 * Library policy singleton accessor.
 *
 * Every threshold in `architecture.md` §Business Rules is read here at runtime
 * (invariant 7 — never hard-coded). Values are cached in memory for 30 seconds
 * so a dashboard request does not re-query on every rule check; `updateSettings`
 * and `invalidateSettings()` drop the cache immediately.
 */

const CACHE_TTL_MS = 30_000;
const SINGLETON_KEY = "global";

/** Field defaults from `data-model.md`; also the first-run seed. */
export const SETTINGS_DEFAULTS = {
  libraryName: "Athenaeum",
  contactEmail: null,
  loanPeriodDays: 14,
  maxActiveLoans: 5,
  maxRenewals: 2,
  renewalExtensionDays: 7,
  finePerDay: 5,
  maxFinePerLoan: 250,
  fineBlockThreshold: 100,
  reservationHoldHours: 48,
  maxReservationsPerMember: 3,
  currencyCode: "USD",
  currencySymbol: "$",
  lastMaintenanceAt: null,
} as const;

type Cached = { value: SettingDoc; expiresAt: number };

let cache: Cached | null = null;

/**
 * Read the policy singleton, creating it with defaults on first call.
 * Callers get the same object shape on every hit thanks to the cache.
 */
export async function getSettings(): Promise<SettingDoc> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  // `upsert` means the very first read seeds the singleton, so no migration
  // step or seed run is required before the app is usable.
  const settings = await Setting.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $setOnInsert: { key: SINGLETON_KEY, ...SETTINGS_DEFAULTS } },
    { upsert: true, new: true, setDefaultsOnInsert: true, lean: true },
  ).lean<SettingDoc>();

  if (!settings) {
    throw new Error("Settings singleton could not be read or created.");
  }

  cache = { value: settings, expiresAt: now + CACHE_TTL_MS };
  return settings;
}

/** Drop the cache. Called after any write, and by tests. */
export function invalidateSettings(): void {
  cache = null;
}

/**
 * Partial update of the policy singleton.
 *
 * Implemented in **Unit 19** (Settings admin UI) — Unit 02 lands the accessor and
 * cache invalidation so later units can read policy values safely.
 */
export async function updateSettings(
  _patch: Partial<SettingDoc>,
  _actor: Actor,
): Promise<SettingDoc> {
  invalidateSettings();
  throw new Error("updateSettings() is implemented in Unit 19.");
}

/** The safe subset exposed to anonymous visitors by `GET /api/settings/public`. */
export type PublicSettings = Pick<
  SettingDoc,
  | "libraryName"
  | "loanPeriodDays"
  | "maxActiveLoans"
  | "maxRenewals"
  | "finePerDay"
  | "currencySymbol"
  | "reservationHoldHours"
>;

export async function getPublicSettings(): Promise<PublicSettings> {
  const s = await getSettings();
  return {
    libraryName: s.libraryName,
    loanPeriodDays: s.loanPeriodDays,
    maxActiveLoans: s.maxActiveLoans,
    maxRenewals: s.maxRenewals,
    finePerDay: s.finePerDay,
    currencySymbol: s.currencySymbol,
    reservationHoldHours: s.reservationHoldHours,
  };
}
