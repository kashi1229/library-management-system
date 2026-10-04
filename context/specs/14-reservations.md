# Unit 14: Reservations (Holds)

## Goal
Members reserve unavailable books; the system manages a FIFO queue, holds returned copies for the next member, expires stale holds, and lets staff fulfil or cancel.

## Design
Book detail availability panel now shows **Reserve** (when no effective copy) with queue position preview ("You'd be #3 in line"); after reserving it shows "You're #2 in line" with a Cancel link; when ready: success-tinted panel "Ready for pickup — hold expires in 41h" with countdown. Member `/reservations`: cards grouped by Ready / Waiting / Past; each card with cover, title, queue position badge or countdown, cancel button. Staff `/staff/reservations`: tabs Ready / Waiting / History, table (book, member, queue position, requested date, expires), actions **Fulfil** (issues the book to that member) and **Cancel**. Per-book queue viewable from the staff books table row menu ("View queue" Sheet).

## Implementation
- `lib/services/reservations.ts`:
  - `reserveBook(bookId, actor)` per rule 5 (messages: "Copies are available — visit the desk", "You already reserved this book", "You have reached the reservation limit", "You already have this book on loan").
  - `cancelReservation(id, actor)` (owner or staff). If cancelling a `ready` hold → `promoteReservationQueue`.
  - `promoteReservationQueue(bookId, tx)` — real implementation replacing stub: computes free copies = `availableCopies − readyCount`; while free > 0 and a `waiting` reservation exists, promote oldest to `ready` with `readyAt` and `expiresAt = now + reservationHoldHours`; notify (stub until 16).
  - `expireStaleReservations()` (ready & `expiresAt < now` → `expired`, then promote), also invoked lazily at start of `reserve`/`listReservations`.
  - `fulfilReservation(id, actor)`: requires `ready`; calls `issueLoan` with the member and book inside one transaction; marks `fulfilled` with `fulfilledLoan`.
  - `fulfilReadyReservationIfAny` (replaces stub used by issue), `getReadyHoldCounts(bookIds)`, `countOtherReservations(bookId, memberId)` (replace stubs; renew rule now blocks when others wait).
  - `getQueueInfo(bookId, memberId?)` returns `queueLength` and the member's position.
- Catalog and detail now use real `effectiveAvailable`, `queueLength`, and `userState.reservation`.
- Routes per contract. Validators `lib/validators/reservation.ts`.

## Dependencies
None new.

## Verify when done
- [ ] Cannot reserve while a copy is effectively available; can when all copies out or held.
- [ ] Duplicate reservation and limit (3) rejected; active-loan duplicate rejected.
- [ ] Returning the last copy promotes the oldest waiting reservation to `ready`; copy is not issuable to another member.
- [ ] Expired holds become `expired` and the next in line is promoted.
- [ ] Staff fulfil issues the loan and marks reservation `fulfilled`; member issue via desk also fulfils their ready hold.
- [ ] Renewal is blocked when someone is waiting.
- [ ] Catalog availability counts reflect holds.
- [ ] Responsive; light/dark OK · No TypeScript/console errors · `npm run build` passes.
