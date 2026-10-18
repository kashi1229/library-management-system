# Project Overview — "Athenaeum" Library Management System

(Working product name: **Athenaeum**. Can be renamed in Settings and one constant in code.)

## Overview

Athenaeum is a web-based Library Management System for a university or college library. It digitises the complete
lifecycle of a library: cataloguing books, registering members, issuing and returning books, renewals, reservations
(holds), overdue tracking, fines, notifications, and reporting. Members browse a beautiful public catalog, reserve
and track books, and manage their own account. Librarians run the circulation desk. Admins configure policy,
manage staff, and view analytics. The interface is minimal, warm, and artistic ("parchment and ink"), fully
responsive, and animated with purposeful, subtle motion.

## Goals

1. Provide a complete, fully working circulation system (issue, return, renew, reserve, fine) with correct business rules.
2. Provide three role-based experiences (Admin, Librarian, Member) with enforced access control on every route and API.
3. Deliver a stunning, minimal, responsive UI with consistent design tokens, Lucide icons, and tasteful animation.
4. Store all book covers and avatars in Cloudinary through secure signed uploads.
5. Provide dashboards and reports with real data, charts, and CSV export.
6. Ship with realistic seed data so every screen is demonstrable on day one (for the university viva/demo).
7. Be simple enough to explain and defend as a university project: clean architecture, clear ER model, documented rules.

## User Roles

| Role | Who | Capabilities |
|---|---|---|
| **Visitor** | Not signed in | Browse landing page, browse/search catalog, view book details and reviews. Cannot borrow, reserve, or wishlist. |
| **Member** | Student / faculty | Everything a visitor can, plus: reserve books, wishlist, review books, view own loans/fines/history, renew own loans, receive notifications, edit profile. |
| **Librarian** | Library staff | Manage books and categories, manage members (view, suspend/activate), issue/return/renew loans, manage reservations, collect/waive fines, view dashboard and reports. |
| **Admin** | Head librarian / IT | Everything a librarian can, plus: create/disable librarian accounts, edit library settings and policies, view audit log, run maintenance. |

## Core User Flows

**Member flow**
1. Visit landing page → Register (name, email, password, phone, department) → auto-signed-in as Member with a generated membership ID.
2. Open Catalog → search/filter → open a Book Detail page.
3. If copies available: walk to the desk (a librarian issues it). If none available: tap **Reserve** → join the queue.
4. Receive an in-app notification when a reserved copy is **ready** (held 48h by default).
5. After issue, see the loan under **My Loans** with a due date and countdown. Tap **Renew** (if allowed).
6. After return, review/rate the book. If returned late, see the fine under **Fines** until a librarian marks it paid.

**Librarian flow**
1. Sign in → Staff Dashboard (today's issues/returns, overdue count, ready holds, low-stock books).
2. Add a book (cover upload, details, copies) or edit/archive one.
3. Open **Circulation Desk** → search member by name/ID/email → search book by title/ISBN → **Issue**.
4. To return: find the active loan (scan/type book ISBN or member ID) → **Return** → system computes fine and promotes the next reservation.
5. Manage reservations, collect fines, view reports.

**Admin flow**
1. Everything above, plus: create librarian accounts, change library policy settings, review the audit log, run maintenance.

## Features (Detailed Catalog)

### F1. Authentication & Accounts
- Register (member only), login, logout, persistent session (7 days) via httpOnly cookie.
- Password rules: min 8 chars, at least one letter and one number. Hashed with bcrypt.
- Role-based route protection (middleware + server-side checks in every API route).
- Suspended members can log in but see a restricted banner and cannot reserve, renew, or be issued books.
- Admin creates librarian accounts (name, email, temporary password) and can disable them.
- Generated membership ID format: `LIB-<year>-<4-digit-sequence>` (e.g. `LIB-2026-0042`), unique.
- Forgot-password is **out of scope**; admin can reset a user's password manually (sets a temporary password).

### F2. Profile
- View/edit name, phone, department; change password (requires current password).
- Avatar upload to Cloudinary with live preview, crop-to-square, remove avatar.
- Read-only: email, membership ID, role, member-since date.

### F3. Categories
- CRUD by staff: name, slug (auto), description, Lucide icon name, accent color token.
- Cannot delete a category that has books (must reassign first; UI explains why).
- Category cards on the landing page and catalog filter.

### F4. Books (Catalog Management)
- Fields: title, authors (multiple), ISBN (10 or 13, validated, unique), publisher, year, edition, language, category, tags, description, page count, shelf location, total copies, cover image.
- Cover uploaded to Cloudinary (drag-and-drop, preview, replace, remove). If no cover: elegant generated typographic cover.
- `availableCopies` is system-managed; staff edit `totalCopies` only (cannot go below copies currently on loan).
- Archive/restore a book (archived hidden from public catalog, retained for history). Hard delete only if the book has never been loaned.
- Staff table: search, filter by category/status, sort, pagination, row actions, quick copy-count display, bulk archive.

### F5. Public Catalog & Book Detail
- Grid/list toggle, search (title, author, ISBN, tags), filters (category, language, availability, year range), sort (newest, title, most popular, top rated), pagination.
- Debounced search with URL-synced query params (shareable links).
- Book detail: large cover, metadata, availability badge ("3 of 5 available"), queue length if reserved, description, reviews and rating summary, related books (same category), actions (Reserve / Wishlist / Share link).
- Skeleton loaders and empty states.

### F6. Members Management (Staff)
- List with search (name, email, membership ID), filter by role/status, pagination.
- Member detail page: profile, active loans, loan history, fines, reservations, quick actions (suspend/activate, reset password, issue a book).
- Admin: create/disable librarians (separate Team page).
- Suspend requires a reason; member gets a notification.

### F7. Circulation (Issue / Return / Renew)
- **Issue**: librarian selects member and book; system validates policy (see Business Rules) and creates a loan with due date = today + loan period.
- **Return**: marks returned, restores copy, calculates fine if late, promotes next waiting reservation.
- **Renew**: by member (own) or librarian; extends due date by renewal days; limited count; blocked if the book has waiting reservations or the loan is overdue.
- Circulation Desk page: two-pane search (member, book), active loans table with status chips (On time / Due soon ≤3 days / Overdue), one-click return/renew.
- Every action writes an audit log entry and, where relevant, a notification.

### F8. Reservations (Holds)
- Member reserves a book only when no copy is free for them. One active reservation per member per book. Max 3 active reservations per member.
- Queue is FIFO. When a copy is returned, the first waiting reservation becomes **ready**, a copy is held for `reservationHoldHours` (default 48), and the member is notified.
- If not collected before expiry, the reservation expires and the next in queue is promoted.
- Members can cancel. Staff can fulfil (issues the book directly from the reservation), cancel, or view queue per book.

### F9. Fines
- Fine = days overdue × `finePerDay`, capped at `maxFinePerLoan` (default = book-price-agnostic cap of 50× rate).
- Created automatically at return time when late. Statuses: unpaid, paid, waived.
- Staff collect (record payment method: cash/other, with optional note) or waive (with reason).
- Members with unpaid fines above `fineBlockThreshold` cannot be issued new books.
- Member Fines page shows outstanding total and history. Staff Fines page shows all with filters and totals.

### F10. Wishlist & Reviews
- Member can save/remove books to a wishlist (heart toggle with animation).
- Reviews: 1–5 stars + optional comment, only by members who have borrowed that book at least once; one review per member per book; edit/delete own review; staff can remove inappropriate reviews.
- Book average rating and count are maintained on the book.

### F11. Notifications (In-App)
- Bell icon with unread badge, dropdown preview, full Notifications page, mark as read / mark all read.
- Types: loan issued, due soon (≤2 days), overdue, returned, fine created, fine paid/waived, reservation ready, reservation expired, account suspended/activated, new reservation on a book (staff, optional).
- Generated by services at event time; due-soon/overdue generated by the maintenance job.

### F12. Dashboards
- **Member dashboard**: greeting, active loans (with due countdown), ready holds, outstanding fines, recently viewed/wishlist preview, recommended books (same categories as past loans).
- **Staff dashboard**: KPI cards (total books, total copies, members, active loans, overdue loans, ready holds, unpaid fines), charts (loans per day for 30 days, loans by category, top 5 borrowed books), recent activity feed, low-stock list.

### F13. Reports (Staff)
- Reports: Borrowing history (date range), Overdue loans, Popular books, Member activity, Fines collected, Inventory status.
- Each report: filters, table, summary, **Export CSV**. Print-friendly view.

### F14. Settings (Admin)
- Library name, contact email, loan period days, max active loans, max renewals, renewal extension days, fine per day, max fine per loan, fine block threshold, reservation hold hours, currency code/symbol.
- Settings are read by services at runtime (never hard-coded).

### F15. Audit Log (Admin)
- Immutable list of important actions (who, what, when, entity). Filter by actor, action, date. Paginated.

### F16. Maintenance
- `POST /api/maintenance/run` (admin or `CRON_SECRET`): expires stale reservations and promotes queues, generates due-soon and overdue notifications (idempotent per loan per day). Also triggered lazily when staff open the dashboard and via an Admin "Run maintenance" button.

### F17. Marketing Landing Page
- Hero with animated headline and floating book covers, live stats (books, members, loans), category showcase, "How it works" in three steps, featured/new arrivals carousel, footer. Entirely driven by real data.

### F18. Platform Quality
- Responsive from 360px to 1920px; dark and light themes; keyboard accessible; reduced-motion respected; loading, empty, error, and 404 states everywhere.

## Business Rules (Summary — full detail in architecture.md)
- Loan period 14 days, max 5 active loans, max 2 renewals of +7 days, fine 5 per day, hold 48h (all configurable).
- A member cannot hold two active loans of the same book.
- Copies held for a ready reservation cannot be issued to someone else.

## In Scope
Everything in F1–F18 above, English-only UI, desktop and mobile web, seed script, deployment on Vercel + Atlas + Cloudinary.

## Out of Scope (Do NOT build or suggest)
- Email/SMS sending, push notifications, forgot-password email flow, OAuth/social login, two-factor auth.
- Online payments (fines are recorded manually by staff).
- Barcode/QR hardware scanning (staff type or paste ISBN/membership ID), RFID.
- E-book reading, PDF hosting, digital lending.
- Multi-branch/multi-library, inter-library loans, acquisition/vendor management, book purchasing.
- Real-time sockets, native mobile apps, multilingual/i18n, AI features.
- Automated test suites beyond the manual verification checklists (optional extra, not required).
  **One now exists:** `npm test` runs `node:test` suites through `tsx` — no new dependency — currently
  covering the upload limits (`src/lib/validators/upload.test.ts`).

## Success Criteria
- A visitor can register, sign in, browse and search the catalog, and open a book detail page.
- A librarian can add a book with a Cloudinary cover, find a registered member, issue the book, and see availability drop by one.
- Returning an overdue book creates the correct fine; marking it paid updates the member's totals.
- Reserving an unavailable book, then returning the copy, makes the reservation "ready" and notifies the member.
- Renewal obeys limits and is blocked by reservations and overdue state.
- Every staff-only page and API rejects members and visitors (verified by manual attempts).
- Dashboards and reports show real aggregated data; CSV exports download correctly.
- The seeded app demonstrates every feature with no manual data entry.
- `npm run build` passes with zero TypeScript and ESLint errors; no console errors in normal use.
- All pages are usable at 360px width and at 1440px width, in light and dark themes.
