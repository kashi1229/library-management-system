# Unit 10: Members & Team Management

## Goal
Staff manage members (list, detail, suspend/activate, password reset). Admin manages librarian accounts.

## Design
`/staff/members`: toolbar (search, status tabs All/Active/Suspended), DataTable with avatar+name, membership ID (mono), email, department, status badge, joined date, active-loans count, row menu. Member detail `/staff/members/[id]`: header card (large avatar, name, ID, status, contact), KPI row (active loans, total borrowed, unpaid fines, active reservations), tabs: Overview, Loans, Fines, Reservations (tabs show placeholders "Available after Unit N" until those units exist), action buttons: Suspend/Activate, Reset password, (later) Issue a book. `/staff/team` (admin): list of staff with role badge, status, "Add librarian" dialog (name, email, temporary password with generator button `Wand2`), enable/disable.

## Implementation

### Service/API (`lib/services/members.ts`, `team.ts`)
- `listMembers`, `getMemberDetail` (counts computed via aggregation on loans/fines/reservations — return zeros until those collections have data), `lookupMembers(q)` (name/email/membershipId prefix, max 8, active first — used by circulation), `suspendMember(id, reason, actor)` (sets status + reason; notification stub; audit), `activateMember`, `resetPassword` (generates 10-char temp password with letters+digits, returns it **once**, audit; staff may reset members only, admin may reset librarians).
- Team: `listTeam`, `createLibrarian` (role librarian, no membershipId), `updateTeamMember` (name/status; cannot modify self; cannot disable the last active admin).
- Routes per `api-contract.md`.

### UI
- `MembersTable`, `MemberHeader`, `MemberTabs`, `SuspendDialog` (reason required), `ResetPasswordDialog` (shows temp password with copy button and warning), `TeamTable`, `AddLibrarianDialog`.

## Dependencies
None new.

## Verify when done
- [ ] Members list search/filter/pagination work; member detail loads with correct summary.
- [ ] Suspend requires reason, flips status, suspended user sees the banner on next load.
- [ ] Reset password shows temp password once; user can log in with it.
- [ ] Librarians cannot access `/staff/team` (redirect) or call team APIs (403).
- [ ] Admin cannot disable self or the last active admin.
- [ ] Audit entries written for every action.
- [ ] Responsive (table → cards) · light/dark OK · No TypeScript/console errors · `npm run build` passes.
