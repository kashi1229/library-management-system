import type { ReportType } from "@/lib/constants";

/**
 * The six reports' identity, with **no components in it**.
 *
 * **This file exists because of a boundary, and the boundary is easy to get wrong.**
 * `REPORT_DEFS` originally lived in `reports-screen.tsx`, which is `"use client"`. Both report
 * pages are Server Components and import it — to read one `type` for the default view and to
 * build `generateMetadata`. Next.js turns *every* export of a `"use client"` module into a
 * **client reference** when a Server Component imports it, so `REPORT_DEFS` was not the array at
 * all on the server: it was an opaque reference object, and the first thing that touched it said
 *
 * ```
 * function is not iterable (cannot read property Symbol(Symbol.iterator))
 * ```
 *
 * The type system cannot catch this. A client reference is typed as whatever the export was typed
 * as, so `tsc`, `eslint` and `next build` were all green while the page threw — and it threw at
 * *render*, which is exactly the failure the Unit 17 browser pass exists to find.
 *
 * **So the split is: data here, icons there.** Everything a Server Component needs to describe a
 * report — its type, title, blurb and whether it has a category filter — lives in this plain
 * module, which has no `"use client"` and no JSX and is therefore safe to import from anywhere.
 * The `LucideIcon` components, which only ever get *rendered* in the browser, stay in
 * `reports-screen.tsx` keyed by `ReportType`.
 *
 * This is the same rule `lib/constants.ts` already documents for the nav — *data with no JSX, so
 * Server Components can import it* — and `lib/icons.ts` exists for the mirror-image case.
 */
export type ReportDef = {
  type: ReportType;
  label: string;
  /** One sentence saying what the report answers, for the page header. */
  blurb: string;
  /** Whether this report is about books, and therefore has a category to filter by. */
  hasCategory: boolean;
};

/**
 * The six reports, in navigation order.
 *
 * **A `ReportType`-keyed object rather than an array**, because the only thing a consumer can do
 * with it is look a report up by type. An array invites `[0]` — which is typed `T | undefined`
 * under `noUncheckedIndexedAccess`, and which is exactly the line that failed first — and it
 * invites `find()`, which answers `undefined` for a typo and silently falls through to a
 * fallback. `REPORT_DEFS.borrowing` is total: there is no such thing as a missing report here,
 * because `ReportType` and this object are checked against each other.
 */
export const REPORT_DEFS: Record<ReportType, ReportDef> = {
  borrowing: {
    type: "borrowing",
    label: "Borrowing history",
    blurb: "Every loan issued in the period, with what it cost and whether it came back.",
    hasCategory: true,
  },
  overdue: {
    type: "overdue",
    label: "Overdue loans",
    blurb: "Active loans past their due date, and what they would cost if collected now.",
    hasCategory: true,
  },
  popular: {
    type: "popular",
    label: "Popular books",
    blurb: "Titles ranked by how often they went out in the period.",
    hasCategory: true,
  },
  members: {
    type: "members",
    label: "Member activity",
    blurb: "Members ranked by borrowing in the period, with what they currently owe.",
    hasCategory: true,
  },
  fines: {
    type: "fines",
    label: "Fines",
    blurb: "Fines raised in the period, and how each one was settled.",
    hasCategory: true,
  },
  inventory: {
    type: "inventory",
    label: "Inventory",
    blurb: "Every active title, with what is on the shelf, out on loan, and held for somebody.",
    hasCategory: true,
  },
};

/**
 * The report `/staff/reports` opens, and the fallback for an unrecognised type.
 *
 * **Named, rather than taken from the first entry of a list.** A default that is *derived* has
 * to be re-derived by every consumer, and each derivation is a place to get it wrong; a name is
 * one fact stated once. `borrowing` is both the first report and the right thing to show when a
 * type cannot be resolved.
 */
export const DEFAULT_REPORT_TYPE: ReportType = "borrowing";

/** Every report, in a stable order, for the nav. */
export const REPORT_ORDER: readonly ReportType[] = [
  "borrowing",
  "overdue",
  "popular",
  "members",
  "fines",
  "inventory",
];

/**
 * Look up a report from an untrusted string — a URL segment, most likely.
 *
 * **`unknown` in, `ReportDef | undefined` out, so callers must decide what a miss means.** Both
 * report pages need exactly this, and need to answer differently: the index falls back to the
 * default, while `/staff/reports/[type]` 404s, because a typo in a shared link should say so
 * rather than silently show the wrong report under the right URL.
 *
 * **`in` then cast, rather than indexing with the string.** `REPORT_DEFS[value]` on a
 * `Record<ReportType, …>` needs a cast too, but writing it that way makes the compiler stop
 * complaining at the cast instead of at the call site, so a plain cast of the *key* is the honest
 * form: the `in` check is what makes it safe, and it is one line above.
 */
export function reportDef(value: string): ReportDef | undefined {
  return value in REPORT_DEFS ? REPORT_DEFS[value as ReportType] : undefined;
}