# Unit 13: Fines

## Goal
Automatic fine creation on late returns, member and staff fine views, collect/waive actions, and enforcement of the fine-block threshold.

## Design
Member `/fines`: top summary card (large serif outstanding amount in `danger` if > 0 else a calm "All clear" with `CheckCircle2`), table/list of fines (book cover, title, days overdue, rate, amount, status badge, date). Staff `/staff/fines`: KPI strip (Unpaid total, Collected this month, Waived this month), filters (status tabs, date range, member search), DataTable with row actions **Collect** (dialog: payment method select cash/card/other, optional note, amount shown) and **Waive** (dialog: reason required). Member detail Fines tab implemented.

## Implementation
- `lib/services/fines.ts`: `createFineIfLate(loan, daysOverdue, tx)` — replaces the Unit 11 stub: if `daysOverdue > 0` creates Fine with `amount = min(daysOverdue × finePerDay, maxFinePerLoan)`, stores rate and days, updates `loan.fineAmount`, audits, notifies (stub until 16). `listFines`, `listMyFines` (with `outstandingTotal`), `collectFine`, `waiveFine` (only from `unpaid`; terminal otherwise → RULE_VIOLATION), `getUnpaidTotal(memberId)` (used by issue rule — verify Unit 11 uses it).
- Routes per contract. Validators `lib/validators/fine.ts`.
- Currency formatting from settings (`currencySymbol`).
- Return dialog from Unit 12 now shows the real created fine in the success toast.

## Dependencies
None new.

## Verify when done
- [ ] Returning a book 3 days late creates a fine = 3 × finePerDay (capped at max).
- [ ] On-time return creates no fine.
- [ ] Collect and waive change status once; repeat attempts rejected; reason required for waive.
- [ ] Member with unpaid total above threshold cannot be issued a book until paid/waived.
- [ ] Member sees only own fines; totals correct; staff totals match filters.
- [ ] Audit entries exist for create/collect/waive.
- [ ] Responsive; light/dark OK · No TypeScript/console errors · `npm run build` passes.
