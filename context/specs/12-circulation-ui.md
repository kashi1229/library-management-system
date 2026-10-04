# Unit 12: Circulation UI

## Goal
The librarian Circulation Desk and the member "My Loans" experience, fully wired to the circulation API.

## Design
`/staff/circulation`: split layout. Top: two large search cards side by side — **Member** (search by name, email, membership ID; results dropdown with avatar and status chip) and **Book** (search by title/ISBN; results with cover, copies available). Selecting both reveals a summary "ticket" card (member avatar, book cover, due date preview using loan period, policy checks shown as green/red check rows: member active, copies available, within loan limit, no blocking fines) and a primary **Issue book** button (disabled with reasons if any check fails). Success: confetti-free subtle check animation + toast + resets book selector. Below: tabs **Active loans · Due soon · Overdue · Returned** with a searchable DataTable (cover, title, member, issued, due, state chip with countdown, actions: Return, Renew). Return opens ConfirmDialog showing fine preview (computed client-side from settings for display only; server decides).
`/my-loans` (member): segmented tabs Active / History; Active shown as cards with cover, title, due date, circular countdown ring (days left; color shifts success→warning→danger), Renew button (disabled with tooltip reason), overdue ribbon. History as compact list with returned date and "Write a review" link (wired in Unit 15). Empty states with illustration icon and "Browse catalog" action.
Member detail page (Unit 10) Loans tab is now implemented and an "Issue a book" action opens the Circulation Desk with the member preselected.

## Implementation
- Components: `MemberSearchCombobox`, `BookSearchCombobox`, `IssueTicket`, `PolicyChecklist`, `LoansTable`, `LoanStateChip`, `ReturnDialog`, `RenewButton`, `CountdownRing`, `MyLoanCard`.
- Use `GET /api/members/lookup`, `GET /api/books` (staff, with `q`), and loan endpoints. SWR revalidation after each action; optimistic UI for renew.
- Policy checklist computed from settings (`GET /api/settings/public` returns loan period & limits for display — add a public-safe subset endpoint) and member/book data; final authority is the server error messages shown in toasts.
- Keyboard: Enter selects first result; `Esc` closes lists.

## Dependencies
None new.

## Verify when done
- [ ] Issue flow works end to end and decrements availability visibly in the book search.
- [ ] Policy checklist shows accurate pass/fail; server errors are surfaced clearly.
- [ ] Return works from the desk; renew works for staff and from member My Loans.
- [ ] Overdue and due-soon states, countdown ring colors, and tabs filter correctly.
- [ ] Member can only see own loans; renew disabled states explain why.
- [ ] Issue-from-member-page preselects the member.
- [ ] Responsive at 360px (cards instead of tables); light/dark OK.
- [ ] No TypeScript errors · No console errors · `npm run build` passes.
