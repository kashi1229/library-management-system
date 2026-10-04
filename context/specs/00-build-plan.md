# Build Plan — 21 Units (build strictly in this order)

Ordering rules applied: dependencies first · security before functionality · backend before UI wiring · UI shells before real data · dependencies installed just in time.

| # | Unit | Builds | Depends on |
|---|---|---|---|
| 01 | Bootstrap & Design System | Next.js app, Tailwind tokens, fonts, theme, base UI kit, motion helpers | — |
| 02 | Database & Models | Mongo connection, all Mongoose models, settings singleton, API helpers | 01 |
| 03 | Auth API & Route Protection | Register/login/logout/me/password, JWT cookie, middleware, role guards | 02 |
| 04 | Auth UI | Login & register pages (two-panel), forms, validation | 03 |
| 05 | App Shell & Navigation | Role-aware sidebar, topbar, mobile drawer/tab bar, user menu, placeholder pages | 04 |
| 06 | Cloudinary & Profile | Signed uploads, upload component, profile page, avatar, password change | 05 |
| 07 | Categories | Category API + staff management UI | 06 |
| 08 | Books Management | Book API (CRUD/archive) + staff books table + form with cover upload | 07 |
| 09 | Public Catalog & Book Detail | Search/filter/sort catalog, detail page, related books | 08 |
| 10 | Members & Team Management | Members list/detail, suspend/activate, reset password, librarian accounts | 09 |
| 11 | Circulation Services & API | Issue/return/renew rules, transactions, audit, overdue derivation | 10 |
| 12 | Circulation UI | Circulation desk, member "My Loans", renew, return flows | 11 |
| 13 | Fines | Fine API + member & staff fines UI, collect/waive | 12 |
| 14 | Reservations | Reserve/cancel/fulfil, queue promotion/expiry, UI for member & staff | 13 |
| 15 | Wishlist & Reviews | Wishlist toggle/page, ratings & reviews on detail page | 14 |
| 16 | Notifications | Notification service wiring, bell, dropdown, page, maintenance job | 15 |
| 17 | Dashboards | Member and staff dashboards with KPIs and charts | 16 |
| 18 | Reports, CSV & Audit Log | Six reports, CSV export, audit log viewer | 17 |
| 19 | Settings | Admin policy settings UI + runtime wiring | 18 |
| 20 | Landing Page & Polish | Landing page, motion polish, 404/error pages, a11y pass | 19 |
| 21 | Seed, QA, Docs & Deployment | Seed script spec, QA matrix, README, deployment | 20 |

Note: services for fines/reservations/notifications are *created in their own units* (13, 14, 16). Units 11–12 call small internal hooks (`createFineIfLate`, `promoteReservationQueue`, `notify`) that are implemented as **stubs in unit 11 (documented no-ops)** and replaced by real implementations in units 13, 14, 16.
