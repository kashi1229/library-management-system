# Unit 11: Circulation Services & API

## Goal
Implement the core circulation engine — issue, return, renew, list loans — with transactional correctness and all business rules from `architecture.md`. Backend only.

## Design
No UI.

## Implementation

### Services (`lib/services/circulation.ts`)
- `issueLoan({memberId, bookId, notes}, actor)`:
  1. Load settings, member, book inside a transaction.
  2. Validate every rule (member active & role member, book active, effective availability > 0, active loans < max, no duplicate active loan, unpaid fines ≤ threshold) → throw `RULE_VIOLATION` with specific human messages (e.g. "Member already has 5 books on loan.").
  3. Decrement `availableCopies` using an atomic conditional update (`availableCopies > 0`) — if it fails, throw "No copies available".
  4. Create loan with `dueDate = addDays(now, loanPeriodDays)`, increment `borrowCount`.
  5. Call `fulfilReadyReservationIfAny(memberId, bookId, loanId)` (stub until Unit 14).
  6. Audit `loan.issue`; call `notify(...)` (stub until Unit 16).
- `returnLoan(loanId, actor)`: transaction; load loan (must be `active`); set returned fields; increment `availableCopies` (never above `totalCopies`); compute `daysOverdue = max(0, differenceInCalendarDays(returnedAt, dueDate))`; call `createFineIfLate(loan, daysOverdue)` (stub returning null until Unit 13); call `promoteReservationQueue(bookId)` (stub until Unit 14); audit `loan.return`; return loan summary with `fine` (if any).
- `renewLoan(loanId, actor)`: validates ownership (member) or staff; rules from architecture (active, not overdue, renewCount < max, member active, no waiting/ready reservations by others via `countOtherReservations` stub); extends due date; audit `loan.renew`.
- `listLoans(filters, actor)` and `listMyLoans(memberId, status)`: support `active|returned|overdue|due_soon` (derived), populate book (title, slug, cover, authors) and member (name, membershipId, avatar), sort by dueDate asc for active.
- Helper `deriveLoanState(loan, now)` → `on_time|due_soon|overdue|returned` plus `daysLeft`/`daysOverdue`.
- Stub contract file `lib/services/hooks.ts` documents the three stubs and their future owners (units 13, 14, 16) and must be imported by circulation.

### Routes
`GET /api/loans`, `GET /api/loans/mine`, `POST /api/loans/issue`, `POST /api/loans/:id/return`, `POST /api/loans/:id/renew` per contract. Zod validators in `lib/validators/loan.ts` (ObjectId validation helper).

## Dependencies
None new.

## Verify when done (verify via API client/Thunder Client or temporary dev script, then remove scripts)
- [ ] Issue decrements `availableCopies` by 1 and creates a loan with correct due date.
- [ ] Issue is rejected for: suspended member, archived book, zero copies, duplicate active loan, max loans reached, unpaid fines above threshold — each with a clear message.
- [ ] Two simultaneous issue requests for the last copy → exactly one succeeds; `availableCopies` never negative.
- [ ] Return restores the copy; double-return is rejected; `availableCopies` never exceeds `totalCopies`.
- [ ] Renew extends due date; rejects on overdue, max renewals reached; members cannot renew others' loans (403).
- [ ] `listLoans` correctly derives overdue and due_soon filters.
- [ ] Audit entries exist for issue/return/renew.
- [ ] Member calls to staff-only routes return 403.
- [ ] No TypeScript errors · `npm run build` passes.
