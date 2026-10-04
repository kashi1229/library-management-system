# Unit 18: Reports, CSV Export & Audit Log

## Goal
Six staff reports with filters, summaries, CSV export and print view; plus the admin audit log viewer.

## Design
`/staff/reports`: left list (or top tabs on mobile) of six reports with icons: Borrowing History `History`, Overdue Loans `AlarmClock`, Popular Books `Flame`, Member Activity `Users`, Fines `Receipt`, Inventory `Boxes`. Each report page area: filter bar (date range with presets "7d/30d/90d/This year/Custom", category select where relevant), summary strip (3–4 numbers), DataTable (sortable, paginated), actions **Export CSV** (`Download`) and **Print** (`Printer`, print stylesheet hides chrome, uses ink-on-white). `/staff/audit` (admin): filterable table (actor, action, date range) with action chips and relative + absolute time, expandable row to view `meta` as formatted key/values.

## Implementation
- `lib/services/reports.ts`: `getReport(type, filters)` returning `{summary, columns, rows, meta}`:
  - borrowing: loans in range with member, book, issued, due, returned, state, fine.
  - overdue: active loans past due with days overdue and potential fine.
  - popular: books ranked by loans in range with category and rating.
  - members: members ranked by loans in range with active loans, fines.
  - fines: fines in range grouped totals (collected, waived, unpaid) + rows.
  - inventory: all active books with total/available/on-loan/held counts and low-stock flag.
- `GET /api/reports/:type?format=csv` streams text/csv (UTF-8 with BOM, proper escaping, filename `athenaeum-<type>-<date>.csv`).
- `lib/services/audit.ts`: `listAudit(filters, page)`; `GET /api/audit` admin only.
- Components: `ReportShell`, `DateRangeFilter`, `SummaryStrip`, `ExportButton`, `AuditTable`, `ActionChip`.

## Dependencies
None new.

## Verify when done
- [ ] Each report's summary equals the sum of its rows; filters change results.
- [ ] CSV opens correctly in Excel (BOM, quoted commas/newlines).
- [ ] Print view is clean (no sidebar/topbar), readable on A4.
- [ ] Audit log shows entries from earlier units; filters work; librarians get 403.
- [ ] Members cannot access reports or audit.
- [ ] Responsive; light/dark OK · No TypeScript/console errors · `npm run build` passes.
