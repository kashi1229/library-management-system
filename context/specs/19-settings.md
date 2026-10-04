# Unit 19: Settings (Admin)

## Goal
Admin-editable library policy and identity settings, applied everywhere at runtime.

## Design
`/staff/settings`: sectioned cards in a single column with a sticky "Save changes" bar that appears when the form is dirty: **Library** (name, contact email), **Loans** (loan period days, max active loans, max renewals, renewal extension days), **Fines** (fine per day, max fine per loan, fine block threshold, currency code & symbol), **Reservations** (hold hours, max reservations per member), **Maintenance** (last run time, "Run maintenance now" button with result summary toast). Numeric inputs with steppers and units suffix ("days", "per day").

## Implementation
- `lib/validators/settings.ts`: ranges (loan 1–90, max loans 1–20, renewals 0–10, extension 1–30, fine/day 0–1000, max fine ≥ fine/day, threshold ≥0, hold 1–240, reservations 1–10, currency symbol ≤3 chars).
- `updateSettings(patch, actor)` real implementation: validate, update singleton, bust cache, audit with changed keys.
- `GET/PATCH /api/settings` (admin), `GET /api/settings/public` (already created in Unit 12; extend if needed; safe subset: libraryName, loanPeriodDays, maxActiveLoans, maxRenewals, finePerDay, currencySymbol, reservationHoldHours).
- Wire `libraryName` into Logo/landing/metadata/footer; currency into all money displays; confirm no hard-coded policy numbers remain (search the codebase for literals 14, 5, 7, 48 in service/UI code and replace with settings).
- Maintenance button calls `POST /api/maintenance/run`.

## Dependencies
None new.

## Verify when done
- [ ] Changing loan period affects the due date of the next issued loan only.
- [ ] Changing fine per day affects fines on subsequent returns; currency symbol changes everywhere.
- [ ] Library name updates in navbar, sidebar, footer, and page titles.
- [ ] Invalid ranges are rejected with field errors; librarians get 403.
- [ ] Maintenance button runs and shows counts.
- [ ] No hard-coded policy numbers remain in code.
- [ ] Responsive; light/dark OK · No TypeScript/console errors · `npm run build` passes.
