# Architecture

## Stack

| Layer | Technology | Role |
|---|---|---|
| Framework | Next.js 16 (App Router), React 19 | Pages, layouts, route handlers, server components |
| Language | TypeScript (strict) | Type safety everywhere |
| Styling | Tailwind CSS v4 (`@theme inline`) + CSS variables | Token-driven theming (light/dark) |
| UI primitives | shadcn/ui (Radix UI via the unified `radix-ui` package) | Accessible dialog, dropdown, select, tabs, tooltip, sheet |
| Icons | lucide-react | The only icon library |
| Animation | `motion` (framer-motion v12+, imported from `motion/react`) | Page transitions, list stagger, micro-interactions |
| Fonts | next/font (Fraunces, Inter, JetBrains Mono) | Display, body, mono |
| Database | MongoDB Atlas | Primary data store |
| ODM | Mongoose 8 | Schemas, validation, indexes, transactions |
| File storage | Cloudinary | Book covers and avatars (signed uploads) |
| Auth | `jose` (JWT) + `bcryptjs` + httpOnly cookie | Stateless sessions, hashed passwords |
| Validation | zod | Single source of truth for request validation (client + server) |
| Forms | react-hook-form + @hookform/resolvers | Typed forms with zod |
| Data fetching | Server Components for reads; `fetch` + SWR-style hook (`swr`) for interactive client lists | Fast initial load, snappy filtering |
| Toasts | sonner | Feedback |
| Charts | recharts | Dashboard and report charts |
| Dates | date-fns | Formatting and date math |
| Theme | next-themes | Light / dark / system |
| Hosting | Vercel (app) + Atlas (db) + Cloudinary (media) | Free tiers sufficient |

> **Note on versions.** The scaffold arrived on Next.js 16 / React 19 rather than the Next.js 15 named in the
> original kit; the App Router APIs used by this project are identical, so the stack was kept as installed
> instead of being downgraded. `framer-motion` is imported as `motion` because v12+ renamed the package —
> same library, same author, same API.

## Design System Conventions (established in Unit 01)

- All colour, radius, shadow and type-scale tokens are CSS variables in `src/app/globals.css`, mapped to Tailwind
  utilities through a single `@theme inline` block. Components use **token classes only**, never raw hex.
- Status colours ship in `-soft` (tint) + `-ink` (AA-safe foreground on that tint) pairs — see `ui-context.md`.
- Motion values live only in `src/lib/motion.ts`; components consume the shared variants and the
  `useMotionVariants()` reduced-motion hook. No ad-hoc durations, easings or springs.
- `Field` (`components/ui/field.tsx`) is the shared label/control/helper/error wrapper; react-hook-form + zod
  land with the first form-bearing unit (04).
- `turbopack.root` is pinned in `next.config.ts` because this project sits inside a larger git repository.

### Cloudinary module split (required, do not merge)

| Module | `server-only`? | Cloudinary SDK? | Imported by |
|---|---|---|---|
| `lib/cloudinary-shared.ts` | no | no | Client Components (`ImageUploader`, `BookCover`) **and** server routes |
| `lib/cloudinary.ts` | yes | lazy `await import("cloudinary")` | Server routes only — `signUpload`, `destroyAsset` |

Client Components may import **only** `cloudinary-shared`. Merging them, or importing `@/lib/cloudinary`
from a `"use client"` file, fails the build with *"`server-only` cannot be imported from a Client
Component"* / *"Can't resolve 'fs'"*. A loud build failure is the intended safety net — the alternative
would be silently shipping `CLOUDINARY_API_SECRET` to the browser.

### Server → Client prop boundary (React Server Components)

Next.js refuses to serialise anything carrying a `toJSON` across the RSC boundary:

```
Only plain objects can be passed to Client Components from Server Components.
Objects with toJSON methods are not supported.
```

A lean Mongoose document qualifies, because its `_id` is an `ObjectId`. So **every
Server Component must serialise service output before passing it to a Client
Component**, using the same serialiser the API route uses:

| Service output | Serialiser | Client shape |
|---|---|---|
| `listCategories()` | `toCategorySummary` (`lib/services/categories.ts`) | `CategorySummary` |
| `getBook` / `listBooks` | built by `toApi` inside `lib/services/books.ts` | `BookSummary` / `BookDetail` |

Both return `string` ids and ISO date strings, so the wire format and the declared
type agree **by construction** rather than by relying on `JSON.stringify` to coerce an
`ObjectId` for us.

> **Never silence this with a cast.** `categories as unknown as CategorySummary[]`
> makes `tsc` and `next build` pass while the page throws at render. A type error at
> the call site is the point of declaring the serialised type on the service.

## Image upload contract

1. Client validates MIME type **and** extension and the size cap (fast UX check only).
2. `POST /api/uploads/sign` returns `{ signature, timestamp, apiKey, cloudName, folder, allowedFormats,
   maxFileSizeBytes }`. `folder` is a zod enum whitelist; `covers` additionally requires a staff role.
3. The client POSTs the file straight to Cloudinary with `XMLHttpRequest` (the only browser API that
   reports upload progress), echoing **every signed field with the same name and value** — including
   `max_file_size`. Omitting a signed field makes Cloudinary reject the upload.
4. `max_file_size` and `allowed_formats` are inside the signature, so the client **cannot widen them**.
5. `PATCH /api/profile` **derives the delivery URL from the `publicId` on the server** and ignores any
   client-supplied `url`. The avatar URL is rendered to other users (staff see it at the desk), so a
   client-controlled URL would be a stored cross-user content/tracking primitive.
6. `DELETE /api/uploads` — staff may delete `athenaeum/covers/*` (detaching it from any book first, and
   writing an audit entry); a member may delete **only their own current avatar**.

## System Boundaries (folder ownership)

```
src/
├── app/
│   ├── (marketing)/            landing page only            [Unit 20]
│   ├── (auth)/                 login, register              [Unit 04]
│   ├── (public)/catalog/       public catalog + book detail [Unit 09]
│   ├── (member)/               dashboard, my-loans, reservations, wishlist, fines, notifications, profile
│   ├── (styleguide)/           dev-only design-system reference (404 in production) [Unit 01]
│   ├── staff/                  all staff pages (layout enforces librarian|admin)
│   └── api/                    route handlers ONLY — thin: auth → validate → call service → respond
├── components/
│   ├── ui/                     shadcn primitives (generated, then restyled onto our tokens)
│   ├── common/                 shared building blocks (PageHeader, EmptyState, StatCard, StatusBadge, ConfirmDialog, BookCover, Logo, Spinner …)
│   ├── layout/                 AppShell, Sidebar, Topbar, MobileNav, ThemeToggle, NotificationBell
│   └── features/<feature>/     feature-specific components (books, loans, members, …)
├── lib/
│   ├── db.ts                   cached Mongo connection
│   ├── auth/                   jwt sign/verify, cookie helpers, getSession, requireRole
│   ├── cloudinary.ts           server config + signature helper
│   ├── validators/             zod schemas (one file per domain)
│   ├── services/               ALL business logic (circulation, fines, reservations, notifications, audit, reports, settings, maintenance)
│   ├── api.ts                  response helpers, error classes, handler wrapper
│   ├── constants.ts            enums, roles, statuses, nav config, route lists
│   ├── motion.ts               motion tokens, transitions, springs, shared variants
│   ├── fonts.ts                next/font declarations
│   └── utils.ts                cn(), formatters
├── hooks/                      client hooks (useDebounce, useCurrentUser, useNotifications, useMotionVariants…)
├── types/                      shared TypeScript types
├── models/                     Mongoose models (one file per collection)
src/proxy.ts                     coarse route protection (cookie presence + role claim)
scripts/seed.ts                 seed script (spec in unit 21)
```

> **`proxy.ts`, not `middleware.ts`.** Next.js 16 renamed the file convention; the old name still runs but
> logs a deprecation warning. The exported function is therefore `export default async function proxy(...)`.
> It is still the coarse first gate described in §Auth & Access Model — real enforcement is server-side.

## Service layering (Unit 14)

Services must not form a cycle. The rule that keeps them acyclic is **the shared thing goes in a
leaf**, and there are two such leaves in `lib/services/`:

```
models, settings, notifications, audit      (no service dependencies)
        ↑
hooks.ts        — the reservation QUEUE layer: getReadyHoldCounts,
                  promoteReservationQueue, fulfilReadyReservationIfAny,
                  countOtherReservations.  Depends only on the above.
        ↑
circulation.ts   — issue, return, renew. Calls hooks.ts.
fines.ts         — fine lifecycle + createFineIfLate.
refs.ts          — bookRefs / memberRefs and their placeholders.
        ↑
reservations.ts  — reserve, cancel, fulfil, expire, list, getQueueInfo,
                  activeQueuePositions, hoursUntil. Calls circulation + hooks + refs.
        ↑
books.ts, members.ts, routes, components
```

`wishlist.ts` and `reviews.ts` (Unit 15) sit at the `books.ts` level: `wishlist.ts` imports
`books.ts` because a saved book is returned as the **same `CatalogBook`** the catalog card
renders — one serialiser, so a save cannot show different availability from the page it was
saved from. `reviews.ts` imports models and `refs.ts` only, and owns the rating aggregate,
which is why a review write does not have to go through `books.ts` to update a book.

`notifications.ts` stays in the **leaf tier** with `audit.ts` and `settings.ts`: every
circulation service already calls it, so anything it imported would be imported by all of them.
`maintenance.ts` (Unit 16) sits above `reservations.ts` and `notifications.ts` and imports
neither `books.ts` nor `circulation.ts` — it reads loans and titles and writes notices.

### Two rules the notification layer established (Unit 16)

**A duplicate-key error cannot be caught inside a transaction.** MongoDB aborts the whole
transaction on *any* write error, so `catch (E11000) { return }` leaves the caller inside a
transaction that is already dead: every later write in it fails with *"Transaction has been
aborted"* and the commit fails too. A "handled" duplicate therefore silently destroys the rest
of the unit of work — which is exactly what the spec's "swallow duplicate-key errors from
`dedupeKey`" would have done. **Idempotent keys are read before the insert**, in the caller's
session so the read sees the same snapshot; the unique index remains the guarantee, and the
catch is kept only for the concurrent-insert race, where no transaction is open.

**`getSettings()` upserts, so it is a *write* inside any open transaction.** Any function that
opens a transaction must not call it: the write conflicts with, or self-conflicts against, other
writes to the singleton. Read policy with a plain `Setting.findOne(...).select(...)` inside a
transaction, or read it before opening one. This is the unresolved cause of the Unit 16
maintenance defect — see `progress-tracker.md`.

### Overlapping background work needs two mechanisms (Unit 16)

The maintenance job is protected by **both** a conditional write to `Settings.lastMaintenanceAt`
(which stops two *machines* running it twice) **and** a module-level promise chain in
`runExclusive` (which stops two requests inside one *process* overlapping). Neither alone is
sufficient: the settings claim excludes a second caller from starting work, but two callers can
still overlap between the claim and the first transaction. The staff layout fires a throttled
sweep on **every** page load, so this is an everyday condition rather than an edge case.

`reservations.ts` needs `circulation.ts` (fulfilling a hold issues a loan) and
`circulation.ts` needs the queue primitives, so the primitives **cannot** live in
`reservations.ts` — that is a cycle. It is the same reason `refs.ts` exists. Putting them in a
leaf is what makes the graph acyclic; leaving a stub in the caller-facing service beside a real
implementation elsewhere is what invites someone to call the wrong one.

Two consequences worth stating:

- **`circulation.ts` exports `issueLoanInSession`** — the whole of `issueLoan` minus the
  transaction wrapper. MongoDB has **no nested transactions**, so a service that opens its own
  `withTransaction` cannot call `issueLoan` from inside one without either failing or, worse,
  committing the loan outside the caller's transaction. The transaction boundary is the only
  difference between the two entry points, and it lives in one place per entry point.
- **`getReadyHoldCounts` takes an optional `session`.** It was being read from inside
  `issueLoan`'s transaction *without* it, so the hold count came from outside the snapshot the
  rest of the transaction was reasoning about. Any hook called from inside a transaction must
  take the session; a hook that opened its own connection would write outside it.

> The root `src/app/page.tsx` is a Unit 01 placeholder. **Unit 20** introduces `app/(marketing)/page.tsx`,
> which takes ownership of `/`; the placeholder must be deleted in that same unit to avoid a route conflict.

**Rule of thumb:** UI never talks to Mongoose. API routes never contain business logic. Services never read `Request`/`Response`.

## Storage Model

| Data | Where |
|---|---|
| Users, books, categories, loans, fines, reservations, wishlist, reviews, notifications, audit logs, settings | MongoDB |
| Book cover images, avatar images | Cloudinary (`athenaeum/covers`, `athenaeum/avatars`). MongoDB stores `{ url, publicId }` only || Session | Signed JWT in httpOnly, SameSite=Lax, Secure (prod) cookie named `athenaeum_session` |
| Theme preference | next-themes (localStorage) |
| Nothing else | No Redis, no queues, no external cache |

## Auth & Access Model
- JWT payload: `{ sub: userId, role, name }`, 7-day expiry, signed HS256 with `JWT_SECRET`.
- `proxy.ts` does coarse gating: unauthenticated → `/login?next=…` for `(member)` and `/staff` routes; non-staff hitting `/staff/*` → redirect `/dashboard`; signed-in user hitting `/login` or `/register` → redirect to their home.
- **Real enforcement is server-side**: every route handler calls `requireSession()` / `requireRole([...])`, and re-loads the user from the DB to confirm `status` and current `role` (never trust the token alone for privileged actions).
- Members can only read/modify their own loans, fines, reservations, wishlist, notifications, profile. Ownership is checked in services using the session user id, never an id from the request body.
- Suspended users: may sign in and read; blocked from reserving, renewing, and being issued books. Wishlist and profile edits remain allowed. **Publishing a review is also blocked** (`requireActiveMember`, Unit 15) — it is a member action with a consequence for other readers, not a profile edit.

## Business Rules (authoritative)

All values below are read from the `Setting` singleton.

1. **Issue a loan** — all must hold, else a typed error with a human message:
   - Member exists, role `member`, status `active`.
   - Book exists, status `active`, `availableCopies > 0`, after subtracting copies reserved as *ready* for other members.
   - Member's active loans `< maxActiveLoans`.
   - Member has no active loan of this same book.
   - Member's unpaid fines total `≤ fineBlockThreshold`.
   - If the member has a *ready* reservation for the book, issuing fulfils it (status `fulfilled`, linked to the loan).
   - Effect (single transaction): create loan (`dueDate = now + loanPeriodDays`), `book.availableCopies -= 1`, `book.borrowCount += 1`, audit, notification.
2. **Return a loan** — loan must be `active`. Effect (transaction): set `returnedAt`, `status=returned`, `receivedBy`; `book.availableCopies += 1`; compute fine (`ceil((returnedAt - dueDate)/1 day) × finePerDay`, capped, only if late); create Fine; call `promoteReservationQueue(bookId)`; audit; notifications.
3. **Renew** — loan `active`, not overdue, `renewCount < maxRenewals`, member `active`, **no waiting/ready reservations by other members** on the book. Effect: `dueDate += renewalExtensionDays`, `renewCount += 1`, audit.
4. **Overdue** is *derived*: `status === 'active' && dueDate < now`. It is never stored as a status; queries use the derived condition.
5. **Reserve** — member `active`; `availableCopies − readyHolds == 0` (otherwise tell them to visit the desk); no existing waiting/ready reservation by this member for the book; no active loan of the book; member active reservations `< 3`.
6. **Promote queue** — after any return or reservation expiry/cancel of a ready hold: if free copies exist and a `waiting` reservation exists, oldest becomes `ready`, `readyAt=now`, `expiresAt=now+reservationHoldHours`, notify member. A *ready* reservation consumes one copy from public availability (computed `effectiveAvailable = availableCopies − readyCount`).
7. **Expire** — `ready` reservations past `expiresAt` become `expired`, then queue promotes again.
8. **Fine lifecycle** — `unpaid → paid` (collect) or `unpaid → waived` (waive, reason required). Terminal states cannot change.
9. **Reviews** — only if the member has ≥1 loan (any status) of the book. After write, recompute `ratingAvg`/`ratingCount` on the book.
10. **Book deletion** — only if the book has zero loans ever; otherwise archive. `totalCopies` cannot be set below `(totalCopies − availableCopies)` (copies out on loan).
11. **Category deletion** — blocked if any book references it.

## Maintenance Job (no cron required)
`runMaintenance()` in `services/maintenance.ts`: (1) expire ready reservations and promote queues; (2) create `due_soon` notifications for loans due within 2 days; (3) create `overdue` notifications for overdue loans. Idempotent: uses a `dedupeKey` (`type:loanId:YYYY-MM-DD`) unique on notifications. Triggered by: admin button, `POST /api/maintenance/run` (with `CRON_SECRET` header, usable by Vercel Cron), and lazily on staff dashboard load (throttled to once per 10 minutes via a `lastMaintenanceAt` stored in Settings).

## Invariants (rules the codebase must NEVER violate)

1. **No business logic in route handlers or components.** All rules live in `lib/services/*`.
2. **Every API route authenticates and authorises first**, using `requireSession`/`requireRole`, before touching data.
3. **Ownership is derived from the session**, never from client-supplied user ids (except staff acting on a member through an explicit `memberId` that is role-checked).
4. **All inputs are validated with zod** before reaching a service. Services assume typed, validated input but re-check business rules.
5. **Multi-document changes (issue, return, reserve-promote, review rating recompute) run in a Mongo transaction.** `availableCopies` must never go negative or exceed `totalCopies`. A review write and `Book.ratingAvg`/`ratingCount` are one transaction (Unit 15): a rating row committed without its aggregate would put a card reading "No ratings" directly above a page listing four reviews. `recomputeBookRating` aggregates the collection rather than adjusting the row in hand, so a concurrent write cannot leave the average counting a review that is not there.
6. **`availableCopies` is only changed by circulation services** (issue/return) and book total-copy edits. Never from the UI or generic update endpoints.
7. **Policy numbers come from Settings**, never hard-coded.
8. **Passwords and `passwordHash` never leave the server.** Every user query used in responses uses a safe projection (`-passwordHash`).
9. **Secrets (`CLOUDINARY_API_SECRET`, `JWT_SECRET`) never reach the client.** Uploads use server-signed parameters; the client only receives signature, timestamp, folder.
10. **Deletes of history are forbidden**: loans, fines, audit logs are never deleted.
11. **Audit logging is mandatory** for: user create/suspend/activate/password-reset, book create/update/archive/delete, issue/return/renew, fine collect/waive, reservation fulfil/cancel by staff, settings change, and **every review write** (`review.create`, `review.update`, `review.delete` — Unit 15). A staff review removal records `moderated: true` and the average and count the book was left at; a member removing their own review records `moderated: false`, so the trail distinguishes moderation from an author taking their words back.
12. **All dates are stored as UTC `Date`**; formatting happens in the UI. "Days overdue" is computed with date-fns `differenceInCalendarDays`.
13. **UI uses only design tokens** from `ui-context.md` (no raw hex values in components) and **only lucide-react icons**.
14. **API responses follow one envelope**: `{ success: true, data, meta? }` or `{ success: false, error: { code, message, fields? } }`.
