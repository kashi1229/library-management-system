# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- **Phase 1 — Foundation, backend, auth, shell, profile, catalog management, public catalog, and members/team.**
  Units 01–10 complete. Units 11 → 21 in progress per the developer's instruction to
  complete the application rather than pause for review per unit.

## Current Goal
- Build Units 11 → 21 in dependency order (see `context/specs/00-build-plan.md`).
- Next unit: **11/12 — Circulation** (issue, return, renew, due-soon and overdue queues).

## Completed

### Unit 10 — Members & Team Management ✅ · `feat/10-members-team`
- `lib/validators/members.ts` — `listMembersQuerySchema`, `lookupQuerySchema`,
  `suspendMemberSchema`, `createLibrarianSchema`, `updateTeamMemberSchema`, `memberIdSchema`.
  `createLibrarianSchema` **reuses `emailSchema` / `passwordSchema`** from
  `lib/validators/auth.ts` so a staff account and a member registration cannot drift on what
  counts as valid. `updateTeamMemberSchema` is a plain object + `.refine()` rather than
  `.extend()` on a refined schema — the Unit 09 Zod 4 trap.
- `lib/services/members.ts` — `listMembers` (escaped regex across name/email/membership ID,
  one `$facet`-free count + page so `meta.total` is honest), `getMemberDetail`,
  `lookupMembers` (capped at 8, **active members sort first**), `suspendMember`,
  `activateMember` (**idempotent** — reinstating an active member succeeds without a second
  audit row or a duplicate notification), `resetPassword`.
  - Suspension always carries a **reason**, stored, audited and notified. Activate **clears**
    the reason, because leaving it would keep showing a stale explanation on the member's
    banner after the problem was fixed.
  - `resetPassword` is the only place a plaintext exists: it is hashed and returned once,
    never stored, never logged, never placed in an audit `before`/`after`.
- `lib/services/team.ts` — `listTeam`, `createLibrarian`, `updateTeamMember`.
  - **`membershipId` is omitted entirely for staff**, not set to `null`. A sparse unique index
    treats an absent field as absent but a stored `null` as a value, so a `null` would limit
    the library to one staff account. This is the first code path that creates a staff user,
    and it is the first exercise of that rule.
  - **Role is not editable**, and an admin cannot change their own status or disable the
    **last active admin** — both would leave nobody able to restore staff accounts.
  - Duplicate email returns a **field** error, not a 500.
- Routes: `GET/POST /api/members`, `GET /api/members/:id`, `GET /api/members/lookup`,
  `POST /api/members/:id/{suspend,activate,reset-password}`, `GET/POST /api/team`,
  `PATCH /api/team/:id`. Matches the contract already in `api-contract.md` §Members & Team.
- **`src/lib/password-generator.ts`** — new client-safe module. The temporary password is
  generated **in the browser** so an admin reads it before committing (a mistyped email is
  caught before the account exists) and again server-side on reset, from **one** implementation
  so the alphabet and the letter/digit guarantee cannot drift. Uses `crypto.getRandomValues`
  with rejection sampling (no modulo bias) because this value is a credential; excludes
  `0 O 1 l I` because these are read off a screen once and typed by hand.
- `lib/auth/password.ts` now holds only hashing; it re-exports the generator.
- **UI** — `/staff/members`: `MembersManager` (URL-synced search + Active/Suspended tabs,
  `aria-live` count, server-driven pagination, error and empty states), `MembersTable` (one
  component renders the desktop `<table>` and the stacked mobile cards from the same data),
  `MemberRowActionMenu` (destructive action swaps with status instead of sitting disabled),
  `SuspendDialog` (reason is required and is the point of the dialog), `ResetPasswordDialog`
  (confirm → reveal-once with copy, and it says so).
  `/staff/members/[id]`: `MemberHeader` (identity, status, the suspension reason, four KPI
  `StatCard`s) + `MemberTabs` (Overview, Loans, Fines and Reservations all render **real
  rows** from the record — see the fix below; the first version shipped them as
  "arrives with the circulation work" placeholders, which was wrong).
  `/staff/team`: `TeamManager` + `AddStaffDialog` (**role-aware**: librarian or administrator,
  chosen in the dialog; password generated up front so a mistyped email is caught before the
  account exists) + `RenameTeamMemberDialog` + `RolePicker`, all with one scroll region and a
  pinned footer per the Unit 07 rule.
- `src/hooks/use-member-filters.ts` follows Unit 08's **focus-owns-the-value** rule and the
  per-kind history rule rather than rediscovering them.
- **The detail page needs no serialisation step**: `getMemberDetail` reads `.lean()` and maps
  through `toMember`, so it already returns a plain object — unlike Unit 08's `listCategories`.
- **Verified against the live local MongoDB** after the two fixes below (login as admin,
  `/api/members`, `/api/members/:id`): counts and rows agree
  (`activeLoans=1, totalBorrowed=1, unpaidFines=0, activeReservations=1`), the loan row
  carries its real book title, `view=on_time` and ISO dates, and the waiting hold reports
  `queuePosition=1`. The reset-password reveal is fixed but was **not** confirmed in a
  browser — see the note on that fix.

### Unit 01 — Bootstrap & Design System ✅ · `feat/01-bootstrap-design-system`
- Restructured to `src/` with the `@/*` → `./src/*` alias, matching `architecture.md`.
- **Parchment & Ink tokens** in `src/app/globals.css`: full light + dark palettes, radii, `shadow-soft` /
  `shadow-lift`, type scale, category accents, and `-soft` + `-ink` status pairs, mapped to Tailwind through
  one `@theme inline` block.
- **Fonts** via `next/font` — Fraunces (display), Inter (body), JetBrains Mono (codes).
- **Theme**: `next-themes` (class strategy, `system` default) + animated `ThemeToggle`.
- **Base UI kit**: 23 shadcn/ui primitives restyled onto the tokens, plus `Field` and root `not-found.tsx`.
- **`components/common`**: `PageHeader`, `EmptyState`, `StatCard` (+ skeleton, count-up), `StatusBadge`,
  `ConfirmDialog`, `BookCover` (2:3 + generated fallback), `Logo` (+`InitialAvatar`), `Spinner`, `FormAlert`.
- **`src/lib/motion.ts`** (`motionTokens`, `transitions`, `springs`, `fadeUp`/`stagger`/`scaleIn`/`slideIn`
  + `*Reduced`) and `src/hooks/use-motion-variants.ts` built on `useSyncExternalStore`.
- **`lib/utils.ts`**, **`lib/constants.ts`** (all domain enums, routes, nav config), **`lib/cloudinary.ts`**.
- **Style guide** at `/styleguide` (dev-only, hard-404 in production).
- Verified: 0 console errors · CLS 0.0000 · both palettes · 360/768/1280 · contrast ≥ 4.5:1 · prod 404.

### Unit 02 — Database & Models ✅ · `feat/02-database-models`
- `lib/db.ts`: cached `connectDB()` on `globalThis`, `withTransaction()` via `session.withTransaction`,
  clear error when `MONGODB_URI` is missing.
- **12 Mongoose models** with every index from `data-model.md`, enums reused from `lib/constants`:
  - `Book` weighted text index (title 5, isbn 4, authors 3, tags 2) + pre-validate guard on
    `availableCopies <= totalCopies`.
  - `Loan` partial unique index on `{book, member}` where `status='active'` — the "one active loan of the
    same book per member" rule is now a database guarantee.
  - `Reservation` FIFO index + partial unique index across `waiting`/`ready`.
  - `Notification` unique sparse `dedupeKey` for maintenance idempotency.
  - `AuditLog` createdAt-only, never updated or deleted. `User.passwordHash` is `select:false`.
- Services: `getSettings()` (upserts singleton, 30s cache), `logAudit()` (real, session-aware, never
  throws), `notify()` (documented stub → Unit 16), `nextMembershipId()` (atomic `$inc` per year).
- `lib/api.ts`: `AppError`, `ok`/`fail`, `parseBody`/`parseQuery`/`parseParams`, `paginate`, `buildMeta`,
  `handler()` (connectDB → callback → error funnel).
- `GET /api/health`.

### Unit 03 — Auth API & Route Protection ✅
- Validators: `registerSchema`, `loginSchema`, `changePasswordSchema` (shared with the Unit 04 forms).
- `lib/auth/*`: `jwt.ts` (jose HS256, 7d), `cookies.ts` (httpOnly/Lax/Secure, dependency-free serialiser),
  `session.ts` (`getSession`, `requireSession` re-reading the user from the DB, `requireRole`, `requireStaff`,
  `requireAdmin`, `requireActiveMember`, `getCurrentUser`, `toPublicUser`), `password.ts` (bcrypt cost 10),
  `rate-limit.ts` (sliding window, 5 / 10 min per IP+email, reset after success).
- Routes: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`,
  `PATCH /auth/password`.
- `src/middleware.ts`: anonymous → `/login?next=…`, member → `/dashboard` on `/staff/*`,
  librarian → `/staff` on admin-only pages, signed-in → role home from `/login` / `/register`.

### Unit 04 — Auth UI ✅
- `AuthLayout`: two panels ≥1024px (form on `background`, decorative panel on `primary` with the Fraunces
  quote and CSS book spines); single column with a compact logo below that.
- `BookSpines`: 10 CSS-shape spines in category accent colours, slow offset sine drift, transform only,
  fully disabled under `prefers-reduced-motion`.
- `PasswordInput` (Eye/EyeOff toggle, `aria-pressed` + dynamic label), `PasswordStrength` (4 segments,
  Weak/Fair/Good/Strong, polite live region), `TextField` (label + icon + 44px control + message),
  `FormAlert` (role=alert, shake, tone per error class).
- `/login`: email, password, "keep me signed in", inline zod validation, generic error banner, rate-limit
  tone, `next` param validated as a same-origin path only.
- `/register`: name, email, phone, department select (10 options + "Other" free text), password with
  strength meter, confirm password. Server field errors (e.g. email taken) map onto the matching field.
- `lib/api-client.ts`: typed fetch wrapper with the standard envelope and `ApiRequestError`.
- **Verified in headless Chrome**: 57/58 checks passed · **0 console errors, 0 page errors, 0 failed
  requests** · 360/768/1280 × light/dark · CLS 0.0000 · 44px inputs · pointer targets ≥ 40px (checkbox
  ≥ 24px) · strength meter escalates · mismatch detected · 11/11 controls keyboard-reachable with visible
  focus rings · reduced motion disables the spine drift.
  - The single non-pass was a wrong assertion in the harness (it expected 10+ of 12 tab stops to be
    controls; the register form has exactly 11 controls, so the browser chrome takes the rest).

### Unit 05 — App Shell & Navigation ✅
- `AppShell` (member + staff variants): 264px sidebar collapsing to a 72px rail, sticky topbar, mobile
  drawer under 1024px, five-item bottom tab bar under 768px for the member area only.
- `Sidebar` with Main / Manage / Admin sections derived **by role**, so a librarian never sees the Admin
  group. `SidebarItem` active state uses a framer-motion `layoutId` pill; `/staff` and `/dashboard` match
  exactly so the dashboard does not stay lit on sub-pages.
- `Topbar` (hamburger, breadcrumbs, search, bell, theme, account menu), `Breadcrumbs` (labels resolved
  from the nav config so they cannot drift), `MobileNav` (Radix Sheet), `BottomTabBar` (`layoutId` active
  indicator), `UserMenu` (identity, role badge, membership ID, profile, theme, sign out),
  `NotificationBell` (static until Unit 16), `SuspendedBanner` (non-dismissible, `role="status"`).
- Layouts resolve the session user **on the server** and pass it down, so there is no client fetch and no
  auth flash. `staff/layout.tsx` re-checks the role server-side (defence in depth) and admin-only pages
  re-check `requireAdmin()` in the page itself.
- 18 placeholder routes (7 member + 11 staff), each with `PageHeader` + `EmptyState` + `loading.tsx`
  skeleton, plus scoped `not-found.tsx` and a root `error.tsx`.
- **Migrated `middleware.ts` → `proxy.ts`**: Next.js 16 renamed the file convention and the old name logs
  a deprecation warning. Build output now reports `ƒ Proxy (Middleware)` with no warning.
- **Verified in headless Chrome**: 26/26 checks · **0 console errors, 0 page errors, 0 failed requests** ·
  member/librarian/admin each see exactly their own nav (no admin leakage to librarians) · collapse
  264 → 72px and persists across reload · drawer opens, traps focus and closes on Escape · bottom tab bar
  has 5 items with ≥44px targets and none falsely active off-route · staff get no tab bar · suspended
  banner renders · anonymous requests to all six protected route families redirect to `/login` ·
  user menu shows identity and membership ID.

### Unit 08 — Books (Catalog Management) ✅
- `lib/validators/book.ts` — `createBookSchema` / `updateBookSchema` / param and query schemas,
  plus real **ISBN-10/13 mod-11 checksum** validation (`normalizeIsbn`, `isValidIsbn`).
  `updateBookSchema` is composed from the same field schemas rather than
  `createBookSchema.partial()`, so Zod 4's "`.partial()` keeps an inner `.default()`" trap
  cannot clobber `language` on a partial update. Empty input on an optional numeric field
  becomes `undefined`, not a NaN error. `BOOK_SORTS` / `BOOK_STATUS_FILTERS` /
  `staffBooksQuerySchema` all live here; sorts are re-exported from `lib/constants` rather
  than redeclared, because two arrays of the same names is how an option ends up accepted
  by the API and missing from the toolbar.
- `lib/services/books.ts` — `listBooks`, `getBook`, `createBook`, `updateBook`, `setArchived`,
  `deleteBook`, `bulkArchive`. Copy arithmetic is by **delta**
  (`availableCopies += newTotal − oldTotal`), so removing copies can never strand the count
  below zero and the rejection names how many are out on loan. Delete is refused with
  history (and separately with active holds) and only destroys the Cloudinary cover **after**
  the row is gone, so a failed delete cannot orphan the image. Slugs de-duplicate.
  All six actions audited; updates carry `before`/`after`.
- Routes: `GET/POST /api/books`, `GET/PATCH/DELETE /api/books/:id`,
  `POST /api/books/:id/archive`, `POST /api/books/bulk-archive`.
  Every handler is `handler()` → `requireStaff()` → zod → one service call. The `status`
  downgrade to `active` for non-staff lives in the **handler**, so it holds regardless of
  which route reaches the service.
- `lib/api-client.ts` gained `requestWithMeta`, because `request` discarded the envelope's
  `meta` and pagination cannot be derived from `items.length` once a page is full.
- **Wire shapes are declared once, in `types/index.ts`.** The service and the client had each
  declared their own copy of the book payload and they drifted (service `isbn?: string | null`,
  client `isbn: string | null`), which made passing a service result to a client component a
  type error with no obvious cause.
- **`toCategorySummary` / `toApi` are the only ways out of a service.** They existed and were
  not used: the API route relied on `JSON.stringify` coercing ObjectIds to match its declared
  type, and a Server Component passed lean Mongoose documents straight to a Client Component.
  See Architecture §Server → Client prop boundary.
- UI — `/staff/books` (toolbar: debounced search, category select, Active/Archived/All tabs,
  sort menu, filter count + reset; DataTable with cover thumb, title+authors, mono ISBN,
  category chip, availability bar, shelf, status, row menu; under `md` the same data renders
  as stacked cards **with their own select-all**), `/staff/books/new` and
  `/staff/books/[id]/edit` (two-column: cover uploader + live `BookCover` preview on the left,
  Basic Info / Publication / Inventory on the right, **sticky action footer**).
- `IsbnField` (live checksum tick, `aria-describedby` instead of an icon announcement),
  `AuthorsInput` / `TagInput` (chips; authors commit on blur so a surname is never lost,
  tags refuse duplicates with a `role="status"` message rather than dropping them silently),
  `CopiesBar` (`role="progressbar"`, AA-safe `-ink` tones), `BookRowActionMenu`,
  `BookCategoryChip`, `BookStatusPill`, `BookTableSkeleton`.
- `src/hooks/use-book-filters.ts` — the URL is the source of truth for `q`, `category`,
  `status`, `sort`, `page`. **History is per-kind**: discrete choices `push` (so Back undoes
  them, per F5) while the debounced search box `replace`s (a keystroke must not create a
  history entry). See the bugs section for why reconciling the debounce against the URL was
  the hard part.
- `src/hooks/use-unsaved-changes-guard.ts` — `beforeunload` for browser-level navigation, the
  **Navigation API** for the hardware Back button (no click event to intercept), and a
  capture-phase same-origin link interceptor as the fallback. It reports the blocked
  destination and never navigates itself, so the host owns both the confirmation and a
  client-side transition.
- **Verified end to end against a real local MongoDB** — 73 API checks and 129 browser checks,
  0 page errors, 0 unexpected console errors, 0 unexpected failed requests:
  create → appears in the table with the right copies; raising/lowering `totalCopies`
  recalculates `availableCopies` and lowering below the on-loan count is refused with the
  number named; bad checksum / wrong length / duplicate ISBN each return a **field** error;
  archive/restore both ways; delete refused for loan history and for active holds, and
  allowed for a never-loaned book; search matches title, author, ISBN and tag; category filter,
  six sorts and pagination all work and are shareable by URL; bulk archive is idempotent;
  anonymous and member callers get 401/403 on all five mutation routes; the unsaved-changes
  guard blocks a sidebar link, preserves the draft on "Keep editing", and really navigates on
  "Discard"; Save is inside the viewport at 1920×1080, 1440×900, 1366×768, 1280×720 and
  1024×640; 360/768/1280 × light/dark, no overflow, no mojibake, CLS ≈ 0; all six audit actions
  present in the database with `before`/`after` on updates.

## Next Up
1. **11/12** Circulation → **13** Fines → **14** Reservations →
   **15** Wishlist & Reviews → **16** Notifications → **17** Dashboards →
   **18** Reports & Audit → **19** Settings → **20** Landing & Polish → **21** Seed, QA, Docs & Deploy.
   - **Unit 11/12 needs a Mongo replica set.** Issue, return and reserve-promote run in
     transactions, and the current local instance is standalone. This is the first unit that
     cannot be verified until `MONGODB_URI` points at a replica set.

### Unit 09 — Public Catalog & Book Detail ✅
- `src/app/(public)/layout.tsx` — a public shell deliberately **not** `AppShell`: a visitor
  has no sidebar, breadcrumbs or notifications, and rendering an authenticated nav for
  someone who cannot use it is worse than none. The session is read from the **cookie
  only** (no database round trip), purely to choose between "Sign in" and initials, so a
  page any anonymous visitor can reach stays cheap. `PublicNav` (sticky, translucent,
  border appears on scroll, in-flow mobile panel) and `PublicFooter` (three columns whose
  links are real catalog shortcuts rather than a second nav bar).
- **Service additions** — `getReadyHoldCounts`, `withAvailability`, `getCatalogBook`,
  `listRelatedBooks`, `getCatalogFacets`.
  - **`effectiveAvailable` is real, not a stub.** The spec suggested stubbing it, but the
    reservation collection already exists and the query is one round trip, so returning
    zeros would have left a number the catalog displays for Unit 14 to remember to fix.
  - **`availability=available` is filtered after fetching, and that is documented as a
    deliberate trade-off.** The predicate is `availableCopies − readyHolds > 0` across two
    collections; a `$lookup` inside `find()` cannot be followed by the `skip`/`limit`
    Mongo needs to paginate correctly. Filtering *after* `skip`/`limit` would make the
    total a lie and let "Next" show an empty page, so the matching set is fetched, filtered
    and then sliced.
  - `listRelatedBooks` ranks by `borrowCount`, then rating, then title, with `_id` last —
    "more in this category" is only useful if the suggestions are actually related.
  - Facet counts are over **active** books and are deliberately **not** narrowed by the
    other filters: a facet that renumbers itself as you type reads as options vanishing.
- **API** — `GET /api/books` gained `availability`, `yearFrom`, `yearTo` (an inverted
  range is a 422, not a silent empty result); new `GET /api/books/facets` and
  `GET /api/books/:id/related`; `GET /api/books/:id` now returns the **catalog** shape
  (`effectiveAvailable`, `queueLength`, `userState`) that the detail page needs, while the
  staff edit form keeps reading `getBook()` server-side for raw counts. An archived book
  404s on `/related` too, so it cannot advertise its neighbours.
- **UI** — `CatalogBrowser` (SWR keyed on the filters, desktop sticky filter column and a
  mobile bottom `Sheet` rendering the **same** `CatalogFilterPanel`), `BookCard` (whole card
  is the link; availability overlaid on the cover), `BookListRow` (list mode shows year,
  publisher, page count and a description snippet the grid has no room for),
  `AvailabilityBadge` (one pip per copy, falling back to text above 12 so a 999-copy
  textbook does not render 999 elements), `StarRating` (clipped overlay fill, so 4.3 shows a
  precisely 30%-filled fifth star instead of rounding to 4), `ReadMore` (measures whether it
  actually overflows rather than clamping to a guessed height), `CatalogToolbar` with an
  `aria-live` result count, `useCatalogFilters`.
- `useCatalogFilters` copies Unit 08's **focus-owns-the-value** rule for the debounced
  search box rather than rediscovering it, and adds the per-kind history rule (discrete
  filters `push`, search `replace`s). `view` (grid/list) is **deliberately not in the
  URL** — it is a presentation preference, and every shared link would otherwise carry the
  sender's screen choice; it persists to localStorage instead.
- Verified against the local MongoDB: `/catalog`, `/catalog?sort=title`, a detail page and
  all three new/changed API routes return 200; facets return correct per-category counts,
  icons, languages and a 1969–1996 year range; `availability=available` drops 33 → 32 and
  removes the one book with no free copy; a 1990–2000 year filter returns 1 book; an
  inverted range is a 422. `tsc`, `eslint` and `next build` all clean.
- **Deliberately not wired:** Reserve (Unit 14) and the wishlist (Unit 15). The buttons
  render with the label they will have and a tooltip saying when they open, rather than
  shipping controls that silently do nothing. Share *is* live (Web Share API with a
  clipboard fallback), because a share link is genuinely useful for a catalog today.

### Unit 07 — Categories ✅
- `lib/validators/category.ts` — `CATEGORY_ICON_NAMES` (**42-icon curated whitelist**), `createCategorySchema`,
  `updateCategorySchema`, `categoryIdSchema`, and `slugify` (shared with the Unit 21 seed script).
  Icon is a `z.enum` over the whitelist, so a typo in the whitelist itself is a compile error.
- `lib/services/categories.ts` — `listCategories` (one `$lookup` aggregation counting **active** books),
  `createCategory`, `updateCategory` (re-slugs on rename, supports an explicit `reslug`), `deleteCategory`
  (blocked while **any** book references it, with the count in the message). All three audited, updates
  carrying `before`/`after`. Create and update both return `bookCount`.
- Routes: `GET /api/categories` (**public** — catalog filter + landing showcase), `POST`, `PATCH /:id`,
  `DELETE /:id` (staff). Every handler goes through `handler()` → `requireStaff()` → zod → one service call.
- `src/lib/icons.ts` is now the single name→component map. `CATEGORY_ICON_COMPONENTS` is typed
  `Record<CategoryIconName, LucideIcon>` (not `Record<string, …>`) and is resolved at **module scope**, so a
  stored icon name can only ever resolve and its identity never changes. The loose `CATEGORY_ICONS` /
  `categoryIcon` / `categorySwatch` helpers were removed — two sources of truth for the same mapping is how
  they drift.
- `components/common/category-icon-tile.tsx` — the accent tile shared by the card and the dialog preview, so
  `bg` and its matching `on` ink can never diverge. Built with `createElement` because
  `react-hooks/static-components` (React Compiler) rejects a whitelist lookup bound to a JSX tag during
  render; the reference comes from a frozen module map, so it is a false positive, not a real remount risk.
- `components/features/categories/*`: `categories-manager` (SWR + optimistic writes with rollback),
  `category-card` (staggered entrance, `MoreHorizontal` menu), `category-dialog` (RHF + zod, keyed so
  values come from props with no reset effect), `icon-picker` (searchable 42-tile grid), `color-swatch-picker`
  (six accents, tick marks the selection so it does not rely on colour alone).
- `src/hooks/use-roving-radio.ts` — real APG radiogroup behaviour for both pickers: arrow keys move the
  selection, Home/End jump, arrows wrap, and only the checked option sits in the tab order so a 42-tile grid
  never swallows 42 tab stops. The icon search always keeps the current selection visible, so the group can
  never end up with nothing checked and nothing focusable.
- Card layout is **vertical** (tile + menu on one line, name/description full width). The grid is 1 → 2 → 3
  columns. This replaced a side-by-side tile that left ~95px for the heading and truncated nearly every
  category name to "Art…".
- **Verified end to end against a real local MongoDB** (33 API checks + 106 browser checks, 0 page errors,
  0 failed requests): create/edit/delete, duplicate name as an inline field error, delete blocked while
  books exist, live icon + colour preview, arrow-key swatch navigation, optimistic rollback, audit entries
  in the database, 360/768/1280 × light/dark, CLS 0.0000, no overflow, no clipped card text, reduced motion,
  menu focus management.
  - The only console entries are the **intentional** 409 (duplicate name) and 400 (blocked delete) responses
    Chrome logs for any non-2xx fetch.
  - Follow-up pass on the dialog UX: 16/16 checks · 0 console errors, 0 page errors, 0 failed requests ·
    Save visible at every viewport · Save disabled until dirty · Escape / Cancel / outside-click all guard
    dirty input · "Keep editing" restores every edit · "Discard" creates nothing · clean Escape closes
    immediately · body scrolls while the title and footer stay pinned · confirmation copy free of em dashes.

### Unit 06 — Cloudinary Uploads & Profile ✅
- **Module split** (documented in `architecture.md`, must not be merged):
  `lib/cloudinary-shared.ts` is client-safe (no `server-only`, no SDK); `lib/cloudinary.ts` is server-only
  and lazily `await import("cloudinary")` for `signUpload` / `destroyAsset`. Merging them, or importing
  the server module from a Client Component, fails the build — a loud failure that prevents shipping
  `CLOUDINARY_API_SECRET` to the browser.
- `signUpload()` signs `timestamp`, `folder`, `allowed_formats` **and `max_file_size`**, so the client
  cannot widen the constraints. Upload endpoint is rate-limited to 30/hour per user per folder.
- `POST /api/uploads/sign` — zod enum folder whitelist; `covers` requires staff (403 for members).
- `DELETE /api/uploads` — staff may delete `athenaeum/covers/*` (detaching it from any referencing book
  first, with an audit entry); a member may delete **only their own current avatar**, verified against the
  database. Both branches are audited.
- `PATCH /api/profile` — read-only fields (email, membership ID, role, status) are absent from the schema
  and assigned one-by-one, so zod key-stripping plus explicit assignment blocks mass assignment.
- `ImageUploader` — dashed drop zone, drag-over highlight, instant blob preview, determinate progress bar
  via `XMLHttpRequest` (the only browser API that reports upload progress), success tick, remove with
  confirm. MIME **and** extension **and** size validated client-side as a fast UX check.
- Profile page — two columns (identity card + avatar / Details & Security tabs), read-only fields shown
  behind a lock with the reason, strength meter on the new-password field, `/profile` reachable by every
  role with the shell variant chosen from the role.
- **Security review (agent)**: no CRITICAL/HIGH findings. Confirmed blocked — crafted `publicId`
  deletion, member cover upload, `..` traversal, signature widening, SDK/secret in the bundle, NoSQL
  injection, mass assignment, secret/stack-trace leakage. Fixed during the pass:
  - **MEDIUM** — avatar `url` was client-controlled and rendered to other users via a raw `<img>`;
    now **derived server-side from the `publicId`**, removing the attack surface entirely.
  - **LOW** — added a rate limit to signing; added audit entries to both delete branches; derived the
    covers prefix from `folderPath()` instead of a literal.
- **Verified in headless Chrome**: 64/64 checks · **0 console errors, 0 page errors, 0 failed requests** ·
  360/768/1280 × light/dark · CLS 0.0000 · no overflow · all four `/api/profile` + `/api/uploads` routes
  reject anonymous calls · non-image and >3MB files rejected with a clear message · `accept` excludes SVG
  · membership ID rendered in mono · Details/Security tabs switch · three password fields present ·
  **`CLOUDINARY_API_SECRET` / `api_secret` / `apiSecret` absent from every client bundle and the HTML**.

## Bugs Found and Fixed by Browser QA
Recording these because they were invisible to `tsc`, `eslint` and `next build`:
- **`PasswordInput` swallowed `className`** — it applied the class to its wrapper `<div>` instead of the
  `<input>`, so the Lock icon sat on top of the password text.
- **`TextField` never padded custom controls** — `padded` was defined as `Boolean(Icon) && !Control`, so the
  `control` branch that receives `className` could never receive the padding.
- **Checkbox pointer target was 18px** — below WCAG 2.2 SC 2.5.8. Added a transparent `::before` overlay
  taking it to 24px.
- **Sidebar collapse did nothing visually** — `AppShell` hard-coded `w-[264px]` on the `<aside>`, so the
  rail collapsed *inside* a fixed box. Fixed by lifting the preference into a `SidebarState` context that
  both `AppShell` and `Sidebar` read.
- **`server-only` leaked into the client bundle** — `ImageUploader` imported `UPLOAD_LIMITS` and
  `withTransform` from the server module, dragging in the SDK and failing on `fs`. Fixed by the
  `cloudinary-shared` / `cloudinary` split above.
- **Every upload would have failed with `Invalid Signature`** — `max_file_size` was signed but never sent.
  Caught by the security-review agent, not by any compiler.
- **A newly uploaded avatar was never persisted** — `onChange` only touched client state and the next
  server refresh clobbered it, leaving the API's avatar branch as dead code. Now calls `profileApi.update`.
- **A revoked blob URL latched forever** — `preview` was set once and never cleared, so after the first
  upload the preview pointed at a dead object URL and masked the real image.

### Unit 09 — bugs found after the developer reported an empty `/catalog`
The developer came back with "why doesn't /catalog show the books". Both causes were mine,
and **both were invisible to `tsc`, `eslint` and `next build`**, and the first one also
survived a plain HTTP check because the page server-renders a healthy-looking shell.

- **The catalog never fetched anything — the Unit 08 SWR bug, reintroduced verbatim.**
  The fetcher was `(signal?: AbortSignal) => catalogApi.list(query, signal)`, but **SWR calls
  `fetcher(key)`**, so `signal` received the *string cache key* and it went straight into
  `fetch`:
  `Failed to read the 'signal' property from 'RequestInit': Failed to convert value to 'AbortSignal'`.
  No request was ever issued; the page showed "The catalog could not be reached" with the raw
  browser error as the description. Unit 08 hit this exact bug on the staff table, wrote a
  warning about it, and I wrote it again an hour later. Fixed with the same hand-rolled
  `AbortController` (the fetcher takes **no parameters**), and both call sites now carry the
  note.
  - **Why nothing caught it:** `Invoke-WebRequest /catalog` returns **200 with 77KB of
    correct-looking HTML** — the heading, the search box, the whole filter panel with live
    facet counts — because those are all server-rendered. Only the results are client-fetched,
    so an HTTP status check and a build both pass while the page is functionally empty. The
    earlier verification only asserted on status codes and bytes, which is exactly the
    assertion shape that cannot see this class of bug.
- **`effectiveAvailable` was missing from the default list, so every card read "NaN of 1
  available".** I attached it in the `availability=available` branch and in
  `listRelatedBooks`, and forgot it in the ordinary paginated branch. Two compounding causes:
  1. `listBooks` declared its return type as `BookListItem[]`, which does **not** include
     `effectiveAvailable`, so nothing downstream was type-checked against the field the
     catalog actually reads. `CatalogBook` is now the declared return type.
  2. The field was attached at **three** call sites rather than in one serialiser, so
     adding it anywhere meant remembering to add it everywhere else. Every list result now
     leaves through one `serialiseAll`.
  - The earlier check passed because it asserted on `?availability=available`, which is the
     one branch that happened to be correct. **A check that only exercises the branch you just
     wrote is not a check of the feature.**

### Unit 09 — bugs found by build and smoke check
- **`container-page` had no working max-width on any page.** The `@utility` block read
  `max-width: var(--container-7xl)` and `--container-7xl` was never declared, so the
  declaration was invalid at computed-value time and every page fell back to `max-width:
  none`. Invisible up to 1280px — the viewport is the constraint anyway — and wrong on
  every larger screen, which is how it survived seven units of responsive QA. Now
  declared as `80rem` in the `@theme inline` block.
- **`.extend()` on a refined Zod schema is a runtime error.** Adding the inverted-year-range
  check to `listBooksQuerySchema` made `staffBooksQuerySchema`'s `.extend()` throw
  *"Cannot overwrite keys on object schemas containing refinements"*. `tsc` and `eslint`
  were both clean; only `next build` failed, during page-data collection. `safeExtend` is
  the correct call and the reason is now recorded on the schema.
- **`useSearchParams()` is a build error in a prerendered route, not a warning.** The
  catalog opted into the CSR bailout and killed the build. Declared
  `export const dynamic = "force-dynamic"` rather than wrapped in a `<Suspense>` boundary:
  a filterable catalog is per-request anyway, so a static shell buys nothing, and the
  boundary would cost a visible spinner plus a subtree replacement that discards whatever
  the user has already typed — exactly the Unit 08 login-page bug. The detail page reads
  `params` rather than `searchParams` and stays statically renderable.
- **`getSession()` returns only `{ sub, role, name }`.** The public navbar originally wanted
  an avatar, which is not in the token; reading the user record on every public page load
  would put a database round trip in front of every anonymous visitor, so the navbar shows
  initials from `name` instead. Anything needing a live record goes through
  `requireSession()`.
- **The root page shipped a disabled catalog link** (`aria-disabled`, `tabIndex={-1}`, "opens
  in Unit 09"). Correct as a placeholder, wrong to leave behind once the route existed.

### Unit 08 — Books (bugs found by browser QA)
Every item here passed `tsc`, `eslint` and `next build`. None was reachable from an API test.

- **The books table never fetched anything.** The SWR key was `searchParams.toString()`, and
  **SWR treats an empty-string key as "do not fetch"** — so the first load of `/staff/books`,
  which has no query params, issued no request at all. The page rendered a confident
  *"No books yet · 0 books"* over a catalog of 32 books. The key is now `pathname + "?" + query`,
  which is always truthy. A page that renders a confident empty state is the most expensive kind
  of bug: it looks correct.
- **The fetcher received the cache key as its `signal`.** SWR invokes `fetcher(key)`, so a
  fetcher declared `(signal?: AbortSignal) => …` was handed the **string key** and passed it
  straight to `fetch`: `Failed to read the 'signal' property from 'RequestInit'`. Only visible
  once the empty-key bug above was fixed and a request actually fired. Cancellation is now wired
  by hand with an `AbortController`, and the fetcher deliberately takes no parameters.
- **Every unauthenticated visit to a protected page 404'd.** `proxy.ts` built the login redirect by
  assigning `url.pathname = "/login?next=/staff/books"`, and a *path* percent-encodes its `?`, so
  the browser went to the literal route `/login%3Fnext%3D%2Fstaff%2Fbooks` and got the not-found
  page. It survived the Unit 05 pass because the assertion was `url.includes("/login")`, which the
  mangled URL still satisfies — **the test confirmed a string, not a destination.** It now builds
  the query with `searchParams.set`, and the pass asserts on the destination path, the presence of
  the login form, and the round-tripped `next` value.
- **The edit form could never be saved for a book with a year or a page count.**
  `<input type="number">` makes react-hook-form store a JS **number**, while `publishedYear` and
  `pageCount` were declared `z.string()`. The form failed its own resolver with
  `expected string, received number` and silently refused to save — for most books in a catalog.
  Both now accept `string | number`, exactly as `totalCopies` always did. A schema that disagrees
  with its own input element is invisible to every static check.
- **A brand-new book could never be created at all.** `language` was seeded with `""` while the
  schema requires `min(1)`, so a user who never touched the language picker could not submit.
  Defaults to `"English"` now; an existing book keeps its stored value.
- **The search box silently ate the first characters typed.** Three separate attempts failed the
  same way, and the reasons differ enough to be worth writing down:
  1. *"When `q` changes, copy it into `draft`"* — this fires for the hook's **own** debounced
     write. Typing `Le Guin` over ~200 ms commits `L` 350 ms in, and `L` overwrites a draft that has
     already reached `Le Guin`.
  2. *Tracking "the last value I wrote"* — `router.replace` settles a **render late**, so for one
     render `useSearchParams()` still returns the previous query. That is indistinguishable from an
     external change, so the draft was cleared. Observed as `?q=Ln` and `?q=LGuin`.
  3. The fix is **focus as the signal**: while the box has focus the user owns the value and the
     debounce only moves the URL; once focus leaves, the URL wins. It cannot misfire on the lagging
     URL, and it still covers Back, Reset and shared links.
- **The unsaved-changes guard blocked the form's own post-save redirect.** `form.reset()` followed
  by `router.push()` in the same tick leaves the listener installed with `dirty === true`, and
  Next's router fires `navigate` *during* the push. The save succeeded, the redirect was cancelled,
  and the user was left on the form they had just saved with no indication anything happened. The
  host now calls `allowNavigation()` first. The flag is deliberately **not** consumed on first use,
  because Next can emit more than one `navigate` per push and a self-clearing flag let the second
  one block "Discard changes" instead.
- **The discard prompt never opened.** `blockedHref` was recorded but nothing rendered from it, so
  clicking a sidebar link on a dirty form swallowed the click silently and the form looked frozen.
  One piece of state now drives both the intercept and the prompt.
- **A hydration mismatch on the auth pages.** `useReducedMotion()` returns `null` on the server but
  resolves to the real media query on the **first client frame**, so the variant set could differ
  between server HTML and the hydrated tree. This was masked while the login page sat behind a
  `<Suspense>` spinner (so the form never server-rendered); removing that fallback — see below —
  exposed it. `usePrefersReducedMotion()` now folds in `useIsHydrated()`.
- **Passing Mongoose documents to a Client Component.** `listCategories()` returns lean documents
  whose `_id` is an `ObjectId`, and React refuses to serialise anything with a `toJSON` across the
  RSC boundary: *"Only plain objects can be passed to Client Components from Server Components."*
  An `as unknown as CategorySummary[]` cast made `tsc` and `next build` pass while the page threw at
  render. Fixed by serialising with `toCategorySummary` — the same serialiser the API route now
  uses — and the cast is gone. **A cast at this boundary defeats the only check that catches it.**
- **Pagination could show the same book twice and skip another.** Every sort ended in a
  non-unique field, so books sharing a `createdAt` to the millisecond (a bulk import, a seed script)
  had no defined order and Mongo is free to return them differently between page 1 and page 2. All
  six sorts now end in `_id`.
- **`next build` was clean while the search box could not be typed into.** Found by the harness
  asserting on the *URL* after typing rather than trusting the pass.
- **Model caps disagreed with the validator** (title 300 vs 200, shelf 40 vs 20, pageCount
  unbounded vs 10000), so the validator accepted input the schema rejected and the user saw a
  generic 500 instead of a field error.
- **Removed the `<Suspense>` spinner from the login page.** It existed only so `useSearchParams`
  could work in a prerendered page; `?next=` is now read in the Server Component and passed as a
  prop. That removes the visible spinner flash on the most-used page in the app *and* the subtree
  replacement behind it.
- **`data-scroll-behavior="smooth"`** was added to `<html>` because `globals.css` sets
  `scroll-behavior: smooth` and Next.js logs a warning (and animates route scrolls) without it.

### Unit 04/06/07 — earlier units
- **`PasswordInput` swallowed `className`** — it applied the class to its wrapper `<div>` instead of
  the `<input>`, so the Lock icon sat on top of the password text.
- **`TextField` never padded custom controls** — `padded` was `Boolean(Icon) && !Control`, so the
  `control` branch that receives `className` could never receive the padding.
- **Checkbox pointer target was 18px** — below WCAG 2.2 SC 2.5.8. Added a transparent `::before`
  overlay taking it to 24px. A harness measuring `getBoundingClientRect` therefore **cannot** see
  the compliant target; it must read the pseudo-element too.
- **Sidebar collapse did nothing visually** — `AppShell` hard-coded `w-[264px]` on the `<aside>`,
  so the rail collapsed *inside* a fixed box. Fixed by lifting the preference into a `SidebarState`
  context that both `AppShell` and `Sidebar` read.
- **`server-only` leaked into the client bundle** — `ImageUploader` imported `UPLOAD_LIMITS` and
  `withTransform` from the server module, dragging in the SDK and failing on `fs`.
- **Every upload would have failed with `Invalid Signature`** — `max_file_size` was signed but never
  sent. Caught by the security-review agent, not by any compiler.
- **A newly uploaded avatar was never persisted** — `onChange` only touched client state and the next
  server refresh clobbered it, leaving the API's avatar branch as dead code.
- **A revoked blob URL latched forever** — `preview` was set once and never cleared, so after the
  first upload the preview pointed at a dead object URL and masked the real image.

### Unit 07 — Categories (post-review fixes)
Reported by the developer after the first commit, then verified in the browser:
- **Save was unreachable on most laptops.** The dialog measured **1034px tall** and `DialogContent` has no
  height cap and centres itself with `translate-y-[-50%]`, so on any viewport under ~1040px the title was
  clipped off the top and the **Save button sat below the fold with nothing to scroll**
  (`scrollable: false`, `canScrollToSave: false` — genuinely unreachable, not merely awkward). Fixed by
  capping the dialog at `max-h-[calc(100dvh-2rem)]`, making the middle region the only scroll container
  (`overflow-y-auto overscroll-contain`), and pinning the action row. This is the "sticky action footer for
  long forms" rule in `ui-context.md`; it was not being applied. Verified at 1920×1080, 1440×900, 1366×768,
  1280×720 and 1024×640.
- **Clicking "Keep editing" submitted the form.** Replacing the action row with the discard prompt
  unmounted the form's **only submit button**, and a form with none falls into the implicit-submission
  path: the real mouse click fired `SUBMIT` and created a category the user was trying to abandon
  (reproduced with an event log — `CLICK <BUTTON type=button> "Keep editing"` immediately followed by
  `SUBMIT`). Fixed by moving the prompt to its **own pinned row under the header** so the submit button is
  never unmounted; it is also disabled while the prompt is showing. Note: a synthetic `el.click()` did
  *not* reproduce this — only a real mouse click, so the harness must not use `el.click()` for this check.
- **Unsaved edits were dropped silently.** Escape, the close button, Cancel and a click outside now all
  route through `requestClose()`, which asks before discarding. `Escape` on a clean form still closes
  immediately. The prompt is a row rather than a nested `AlertDialog`, because nesting a modal inside a
  Radix dialog strands focus.
- **Save is now disabled until the form is dirty**, so the button's state tells the user whether there is
  anything to save.
- **Confirmation copy cleaned up** per the developer's request: the em dashes are gone from both branches of
  the delete confirmation, rewritten as plain sentences.

### Unit 07 (additions)
- **`PATCH /api/categories/:id` silently wiped `icon` and `color`** — the highest-risk bug of the unit, and
  it passed `tsc`, `eslint` and `next build`. `updateCategorySchema` was built with
  `createCategorySchema.partial()`, and **Zod 4's `.partial()` keeps an inner `.default()`**: renaming a
  category reset its icon to `BookOpen` and its colour to `forest`. Confirmed with a runtime probe before
  changing anything (`PATCH {name}` → `{name, icon:"BookOpen", color:"forest"}`), then fixed by composing
  both schemas from shared field schemas that carry **no** defaults. A duplicate-name check that only
  exercises `POST` will never catch this — the pass asserts a rename *preserves* both fields.
- **`tailwind-merge` treated the type-scale tokens as colours** — `cn("text-primary-foreground",
  "text-small")` classified `text-small` as a text colour and **deleted the colour class**, so elements
  silently inherited body text and lost their contrast. Fixed by registering the eight tokens in
  `extendTailwindMerge({ classGroups: { "font-size": [...] } })` in `lib/utils.ts`. Affects every
  `cn()` call in the app, not just categories.
- **Category glyphs failed WCAG AA** — the tile used `text-primary-foreground` on the category accent, which
  flips with the theme: 3.5:1 on terracotta in light and **1.4:1 on forest in dark**. Fixed by adding the
  theme-independent `--cat-ink-light` / `--cat-ink-dark` tokens (documented in `ui-context.md`) and routing
  every accent surface through `CATEGORY_COLOR_CLASS[color].on`.
- **`accent-foreground` was white on terracotta** (3.7:1, fails AA) → dark warm ink.
- **Card names were truncated to "Art…"** — a side-by-side icon tile inside a four-column grid left ~95px
  for a 20px serif heading. Caught only by reading the screenshot, not by any assertion: every check passed
  because none of them looked at the heading. The card is now vertical and the grid is 1 → 2 → 3 columns,
  and the pass now asserts `scrollWidth <= clientWidth` on every card heading and paragraph.
- **Mojibake shipped to the screen** — the confirm dialog rendered the opening and closing curly quotes as
  `A-circumflex / euro / oe-ligature` triplets, i.e. `Delete` + three mangled glyphs + `Science Fiction?`.
  The em dashes and the smart quotes were **double-encoded**: UTF-8 bytes decoded as Windows-1252 and
  re-written as UTF-8, in 7 files from earlier units (`image-uploader.tsx` even had a mangled separator in
  the visible copy, reading `WebP` + two bad glyphs + `up to 3MB`). Repaired by reversing the transform with
  a byte table derived from Node's own `windows-1252` decoder, applied per line and only where the result
  is valid UTF-8 that no longer contains the signature. The pass now asserts that none of the four tell-tale
  code points (`U+00C2`, `U+00C3`, `U+00E2`, `U+FFFD`) appears in the rendered text.
  - Root cause to avoid repeating: **do not round-trip a source file through PowerShell
    `Get-Content -Raw` + `Set-Content`.** It reads as the system ANSI codepage, so every non-ASCII character
    is corrupted and a BOM is added. Use the editor tools instead.

### Unit 10 — bugs found by the build and by reading the code
- **`server-only` leaked into the client bundle again.** `validators/members.ts` imported
  `isValidMembershipId` from `lib/services/membership.ts`, which is `server-only` and imports
  `mongoose`. The suspend dialog and the member forms import that validator, so the build
  pulled mongoose and the whole driver into the browser. `tsc` and `eslint` both passed —
  **only `next build` caught it**, the same shape as the Unit 06 Cloudinary split. Fixed by
  moving the *format* into a new client-safe `lib/membership-id.ts`, which the service now
  imports, so generation stays server-side and the pattern is reachable from both sides. The
  general rule: a validator is client code, so **nothing it imports may be `server-only`.**
- **The generated password could index past the end of its alphabet.** The first version built
  one combined `ALPHABET` string and then called `randomIndex(52)` for a letter and
  `randomIndex(10)` for a digit. The alphabet has 52 letters and 8 digits, so the digit index
  range was 52–61 against a 60-character string — **two of ten draws returned `undefined`**,
  producing a 9-character password that failed the very policy it was generated to satisfy.
  Nothing catches this: indexing returns `undefined` rather than throwing, and the result is a
  valid `string` after `join`. Fixed with explicit `FIRST_DIGIT_INDEX` bounds and a
  Fisher-Yates shuffle so the guaranteed letter/digit are not always in the same positions.
- **A failed password reset was completely silent.** `ResetPasswordDialog` held the error in
  component state, but `ConfirmDialog` **always** calls `onOpenChange(false)` once `onConfirm`
  settles — so the state was unmounted before it ever painted and the dialog just closed,
  looking like nothing had happened. Now a toast. The general rule: a caller of `ConfirmDialog`
  **cannot** surface an error inline, because it has already been unmounted by the time it
  would render.
- **A hard-coded `maxActiveLoans` in the members table.** `LoanCount` escalated the badge tone
  at `count >= 5`, duplicating `SETTINGS_DEFAULTS.maxActiveLoans`. That number is editable at
  runtime by an admin (invariant 7), so the component would have been correct only until
  someone changed the policy, and would then have warned on the wrong members — worse than not
  warning. There is no client-side settings accessor yet, so the tone is uniform and the
  threshold is left to land with one.
- **`StatCard` takes a component, not an element.** Four KPI tiles were first written
  `icon={<IdCard className="size-4" />}`; the prop is `React.ComponentType<…>`, so the JSX
  element failed to type-check. Worth knowing because passing an element *would* work at
  runtime for most icons and silently lose the size/stroke defaults the component applies.
- **`AuthenticatedUser.id` is a `Types.ObjectId`, not a string.** The team page passed it
  straight to a client component whose rows are keyed by string ids, so the "is this you?"
  comparison would never have matched and the admin could have been offered the action that
  disables themselves. `.toString()` at the boundary, not an `as string` cast.

### Unit 10 — bugs found by the developer using the pages
Both reported after the unit was committed, and both passed `tsc`, `eslint` and `next build`.

- **The detail tabs showed "arrives with the circulation work" instead of the member's data.**
  Loans, Fines and Reservations were rendered as placeholders on the reasoning that those
  units had not been built. **That reasoning was wrong.** The `Loan`, `Fine` and `Reservation`
  collections, their schemas and their indexes have existed since Unit 02 — the data was
  there to read, and `getMemberDetail` was already counting from it. So the screen showed a
  confident, well-formatted statement that it had nothing to show, over a database holding the
  member's loan and hold.
  - `getMemberDetail` now returns the rows as well as the counts, capped at
    `MEMBER_HISTORY_LIMIT` (50) and newest-first, with the **counts left exact** so the UI can
    say "showing the 50 most recent of 340" rather than implying the list is everything.
  - Book titles and covers are resolved in one `$in` query into a `Map`, mirroring
    `categoryMap` in `services/books.ts`, rather than a `$lookup` per row.
  - **The derived loan state is computed in the service, not the component.** `on_time` /
    `due_soon` / `overdue` do not exist in the database (invariant 4), so `loanView()` is the
    single place that derives them — exported, because Unit 11/12 renders the same states and
    must not grow a second copy of the rule.
  - `LoanDisplayState` was added rather than reusing `LoanView`. `LoanView` is the *filter*
    vocabulary that `api-contract.md` defines (`active | returned | overdue | due_soon`); a loan
    out on time has no filter of its own, and reusing `LoanView` would have painted an
    "active" badge on a loan that is entirely in good standing.
  - **Queue positions are counted from one ordered read** of the queues for the books involved,
    not one query per hold. The sort is `createdAt: 1, _id: 1` to match the FIFO index, with
    `_id` as the tiebreaker — without it two holds created in the same millisecond have no
    defined order and the same hold reports a different position on each load.
  - `MemberRecord` lives in `types/index.ts` and both the service and `api-client` alias it.
    `MemberDetail` had been declared separately in each, which is how the Unit 08 payload drifted.
  - **Verified live** against the local MongoDB: `activeLoans=1, totalBorrowed=1, unpaidFines=0,
    activeReservations=1`, the loan row carries its real book title with `view=on_time` and ISO
    dates, and the waiting hold reports `queuePosition=1`.
  - Worth knowing when looking at this screen: **the developer's own account has no loans, fines
    or reservations**, so their record shows correct empty states. The QA member
    `Mia Member` (LIB-2026-9001) is the one with a loan and a hold.
- **The reset password was never shown.** Clicking "Reset password" produced a success toast and
  then nothing at all — no password, no error, nothing to copy. The API was fine: the envelope,
  `request()` and `membersApi.resetPassword` were all correct, and the service returned the
  password. The value was being **destroyed in the client on the way to the screen**.
  - `ConfirmDialog.handleConfirm` captures `onOpenChange` from the render in which the button was
    clicked, then awaits `onConfirm()` and calls `onOpenChange(false)` to dismiss itself. Our
    handler read `!pending` from that **stale closure** — where `pending` was still `false`,
    because the reset had not started when the click was captured — so it took the "user
    cancelled" branch and called `close()`, which cleared `revealed`. The reset had succeeded, the
    toast fired, the password was in state, and the dialog's own auto-close wiped it before the
    reveal could render.
  - Fixed with a **ref** written synchronously on success, not by reading `revealed`. Reading
    state would not have worked: the handler is stale by construction, so `revealed` still reads
    `null` in it no matter when React re-renders. The ref is immune to that.
  - **Not confirmed in a browser.** The 200-draw stress test on the generator was cut short by
    the developer, so the reveal is verified by construction and by the reported symptom being
    explained end to end — not by watching it render. Worth one manual click through at Unit 21.

### Unit 10 — upgraded after the developer's feedback
Two pieces of the team screen were placeholders rather than features. Both are now real.

**Renaming a staff account was a `window.prompt`.**
- One line of `window.prompt("New name for this staff account:", member.name)` guarded by a
  length check. It looked like a browser dialog *inside* the app, so it broke the theme at
  exactly the moment an admin was editing staff; it had no field-level validation, only a
  toast after the fact; it had no discard guard, so Escape threw the text away silently; and
  it asked for a name without showing whose name, or reminding the admin that the name is what
  appears in the sidebar and the audit trail.
- Replaced by `RenameTeamMemberDialog`, following the `CategoryDialog` pattern line for line
  because that one was already fixed for three separate Unit 07 bugs:
  live identity preview (the avatar's derived initials update as you type, which is cheaper
  than explaining the initials rule), a **pinned discard row** rather than a second modal,
  `requestClose()` on every close path, Save disabled until dirty, one scroll region with a
  pinned footer, and the email and role shown as **read-only facts with the reason** — because
  "why can't I change the email here?" is the obvious next question when renaming someone.
- **The name rule is now one schema.** `staffNameSchema` is composed into
  `createStaffMemberSchema`, `updateTeamMemberSchema` and `renameTeamMemberSchema`. Three
  copies of `min(2).max(80)` is three places for the limit to drift, and drift there means the
  form accepts a name the API rejects with a generic 500 — the Unit 08 model-cap mismatch again.
- `renameTeamMemberSchema` is a plain object, **not** `updateTeamMemberSchema` reused: that one
  carries a `.refine()` requiring *a name or a status*, which is right for a PATCH and
  meaningless for a form whose only field is the name.

**There was no way to create an administrator.** Only `createLibrarian`, with the role
hard-coded.
- `POST /api/team` now takes an optional `role` and `createStaffMember` honours it.
  **`role` defaults to `librarian`**, so a caller that forgets the key cannot mint an admin by
  accident; creating one has to be deliberate.
- **Only an admin may create an admin**, checked in the service as well as the route. Minting
  an administrator is the one action on this screen that hands over the ability to change
  library settings and disable other staff, so it does not rely on a single caller.
- **Role is still not editable.** `updateTeamMemberSchema` rejects `role`, so promotion and
  demotion both remain impossible by design; the supported route to gaining an administrator
  is creating one, which writes an audit entry naming the actor who authorised it. The
  last-admin refusal message was corrected from "Promote another librarian to admin" — advice
  the app offers no way to follow — to "Add another administrator".
- **One "Add staff" dialog with an explicit role choice, not a second header button.** Two entry
  points to one form is two places for the copy to drift, and it would make granting full
  authority feel like a routine click. Picking the role inside the dialog puts the capability
  difference in front of the person deciding, and the privileged choice shows a warning
  stating that the account can disable other staff *including yours*.
- `RolePicker` uses **native `<input type="radio">`** inside a `<label>`, not a grid of styled
  buttons. The browser already implements everything an ARIA radiogroup promises: one tab stop,
  arrow keys, correct accessibility tree. `useRovingRadio` exists for *button* grids that have
  to supply that behaviour themselves, and pairing it with real radios would handle every
  arrow keypress twice with the two implementations disagreeing about what is selected.
  Selected and focused states are drawn with `has-[:checked]` / `has-[:focus-visible]` on the
  label, so they follow the real input instead of duplicated state that could disagree with it.
  Each card lists its **capabilities** ("can manage books…") rather than denials, because a
  list of absent power does not help someone deciding.
- Create-dialog Save tracks `isValid`, not `isDirty`: there is no persisted record to differ
  from, and the pre-filled generated password would otherwise make the form permanently dirty.
- **`TEAM_ROLES` was deleted from the validator.** `lib/constants.ts` already exported
  `STAFF_ROLES` for exactly this, so the validator had a second name for the same array —
  the duplication rule from the Unit 08 payload drift, waiting to happen. Worth noting it was
  also declared *below* the schemas, so any schema referencing it above would have been a
  temporal-dead-zone crash on the first import from a route.

**Verified live against the local MongoDB** (25 checks, all passing):
- omitted `role` → `librarian`; `role: "admin"` → `admin`; `role: "member"` → 422
- a newly created administrator **signs in** with the supplied password and comes back with
  role `admin`; a librarian likewise signs in as `librarian`
- a librarian calling `POST /api/team` gets **403**, and `GET /api/team` gets 403
- duplicate email → 409 naming the `email` field; weak password → 422
- `team.create` is audited for both roles, the entry records the role, and the entry contains
  no password material
- **the sparse-index rule was proved, not assumed**: two documents written with
  `membershipId: null` fail with duplicate-key `E11000` on `membershipId: 1`, while the staff
  documents the service actually writes omit the key and both insert fine. The API reports
  `membershipId: null` on read because of the `?? null` projection, which is a *read* fallback
  and not evidence that `null` was stored.
- rename verified separately: 22 API checks and 35 browser checks (dialog opens, live preview
  tracks typing, inline validation, discard guard, Save reachable at 1024x640 and 390x844, real
  save persists), 0 page errors, 0 console errors.

### Unit 10 — harness lessons worth keeping
- **`click({ clickCount: 3 })` does not select an input's text in headless Chrome.** Typing
  appended instead of replacing, which renamed a real admin to `"Athenaeum AdmihgAda LovAelace"`
  and cascaded into four false failures that all looked like product bugs. Ctrl+A + Backspace +
  type then ate the first two characters and dropped the tail (`"Athenaeum Admihg"` → `"henaeum
  Admihg"`). **Set the value through `HTMLInputElement.prototype`'s native setter and dispatch
  one `input` event** — what testing libraries do, and deterministic.
- **A harness that renames real data must restore it in a `finally`, and must print before and
  after.** Two runs left the database dirty before that was added.
- **Assert on a specific node, not on a page's `textContent`.** `/\bAL\b/` failed to match
  because the initials are glued to their neighbours in the concatenated string; reading
  `[data-slot="avatar-fallback"]` was both specific and correct.
- A failing **screenshot write** (`UNKNOWN: unknown error, open …png`) is the harness, not the
  page. The developer had already confirmed the feature worked before that run.

### Unit 10 — deliberately not done
- **The reset-password reveal still needs one manual click-through.** Everything else in this
  unit was checked live; that one was fixed by construction and confirmed by the reported
  symptom being explained end to end, not by watching it render.
- `GET /api/members/lookup` is built and returns real rows, but nothing consumes it yet. It
  exists for the Unit 11/12 circulation desk, which is the only screen that needs type-ahead.
- The per-tab **actions** are not there yet, by design: issuing a book, taking a fine payment
  and cancelling a hold all belong to Units 11/12/13/14. Each tab says which screen will do it
  rather than showing a button that does nothing.

## In Progress
- Unit 11/12 — Circulation. Not started. Needs `GET /api/loans` with `status`, `memberId`,
  `bookId`, `from`, `to`, `page`; `POST /api/loans/issue`; `POST /api/loans/:id/return`;
  `POST /api/loans/:id/renew`; and the desk UI with member lookup, availability re-check and
  the due-soon / overdue queues.
  - **`lookupMembers` from Unit 10 is already built for this** — the `GET /api/members/lookup`
    type-ahead returns up to 8 lightweight rows with active-loan counts, which is exactly what
    an issue form needs. Do not build a second lookup.
  - All three mutations run in `withTransaction()`, so they need a **replica set**. The
    local `MONGODB_URI` is standalone and will reject them.
  - Copy arithmetic must be the **delta** approach Unit 08 established, and
    `availableCopies <= totalCopies` is guarded by a model pre-validate hook.
  - Renewals are bounded by `maxRenewals` and extended by `renewalExtensionDays`; both come
    from the settings singleton, never from a constant (invariant 7).

## Open Questions
- Final product name (default "Athenaeum"). Rename in Settings + `lib/constants` when Unit 19 lands.
- Default currency (default USD, editable in Settings).
- `CLOUDINARY_*` must be real credentials in `.env.local` for the live upload round trip. `MONGODB_URI`
  already points at a running **local** MongoDB, so every non-transactional unit can now be verified against
  a real database (Unit 07 was). **Transactions still need a replica set** — circulation (issue / return /
  reserve-promote) will not work against the current standalone instance.
- Confirmed against the spec: **suspended members may still edit their profile and avatar.**
  `architecture.md` §Auth & Access Model says "Wishlist and profile edits remain allowed", and
  `requireActiveMember()` is reserved for reserve / renew / issue. `PATCH /api/profile` therefore uses
  `requireSession()`, not `requireActiveMember()` — intentional, not an oversight.
- The project has **no test files**. `project-overview.md` scopes automated suites out, but Units 06 and 07
  each found bugs that any test would have caught (broken signature, avatar never persisted, PATCH wiping
  icon and colour). Worth revisiting at Unit 21.
- The browser QA harness lives outside the repo in `%LOCALAPPDATA%\Temp\opencode\qa` (puppeteer-core plus
  the installed Chrome), so no QA dependency is added to the project. Unit 08 added `bootstrap08.mjs`
  (fixtures), `books-api.mjs` (73 checks), `books-page.js` (129 checks), `books-audit.mjs` and
  `run-unit08.ps1`.
- **Fixtures must be data the app would actually accept.** A made-up ISBN in a seed document does not
  fail loudly; it makes the *form* the thing under test, and the pass then reports a save failure instead
  of a fixture mistake. All fixture ISBNs are checksum-valid, and are verified as such.
- **Fixtures must not leak between runs.** Books created *through the app* carry no `__qa` flag, so
  deleting only flagged documents let them accumulate; a stray title sorted ahead of `Kindred` and failed
  an alphabetical assertion that was actually correct. `bootstrap08.mjs` deletes by `__qa`, by
  `addedBy ∈ QA users`, and by a `^QA` title prefix.
- **The local database is nearly empty of activity.** As of this unit it holds 2 members,
  34 books, **2 loans, 0 fines and 1 reservation**, and only one of the two members has any
  history at all. Every screen that renders loans, fines or reservations will therefore look
  empty for most accounts, which reads as "broken" rather than "no data yet". Before browser QA
  on any of those screens, seed realistic activity (an overdue loan, a paid fine, a waived fine,
  a ready hold) or you are testing the empty state and calling it a pass.
  - The QA member with the history is `Mia Member` / LIB-2026-9001; the developer's own account
    has none.
  - `qa.admin@athenaeum.test` was rotated to a fresh password during this unit's verification
    (value deliberately not recorded here). `make-admin.mjs` takes the password as an argument.
- **JSON does not survive a PowerShell argument** — `{a:"b"}` arrives as `{a:b}`. Pass structured data
  through `$env:` instead.
- **`$env:` does not persist between tool calls.** Re-seed the fixtures *and* re-export `QA_FIX` in the
  same command as the test that needs it, or the fixture ids will not match the database.

## Architecture Decisions
- Next.js 16 App Router (scaffold) + Mongoose 9 + Cloudinary signed uploads + jose JWT cookie sessions.
- **A sparse unique index treats an *absent* field as absent but a stored `null` as a value.** So
  `Book.isbn` and `User.membershipId` carry **no `default`**, writers omit the key, and readers use
  `?? null`. A default on either field silently limits the catalog/library to one such record.
- **A Server Component must serialise service output before passing it to a Client Component.**
  Lean Mongoose documents carry a `toJSON` and React refuses to cross the boundary with them. Use
  `toCategorySummary` / `toApi`; **never a cast**, which hides it from the only check that catches it.
- **Wire shapes live in `types/index.ts`, once.** The service produces them and `api-client` consumes
  them; two local copies drifted and produced a type error with no visible cause.
- **Every list sort ends in a unique tiebreaker.** Non-unique sort keys make pagination
  non-deterministic when rows share a timestamp.
- **Schema field types must match what the control actually produces.** `<input type="number">`
  yields a number to react-hook-form; a `z.string()` field then fails its own resolver.
- **Filter history is per-kind:** discrete filter changes `push`, a debounced search box `replace`s.
- **SWR cache keys must never be empty** — an empty-string key means "do not fetch".
- **SWR calls `fetcher(key)`, so a fetcher must declare no positional parameters.** Declaring
  `(signal?: AbortSignal) => …` receives the *string key* and hands it to `fetch`, which
  throws *"Failed to convert value to 'AbortSignal'"*. This bit the staff table in Unit 08 and
  the catalog in Unit 09; cancellation is wired by hand with an `AbortController`.
- **A list endpoint must have exactly one serialisation path.** Attaching a derived field at
  three call sites means adding it everywhere next time. One `serialiseAll`, and the return
  type declares the derived fields so omitting one is a compile error.
- **A client-fetched region is invisible to an HTTP status check.** `/catalog` returns 200
  with a complete-looking shell while the results are client-side only. Assert on the rendered
  result — a card count, a row of titles — not on a status code and a byte length.
- Animation imports from `motion/react`; all timings live in `src/lib/motion.ts`.
- Status colours ship as `-soft` tint + `-ink` foreground pairs to satisfy WCAG 2.2 AA.
- Custom form controls receive `className` on the **input**, not a wrapper, so icon padding composes.
- Controls keep a ≥40px pointer target even when the painted box is smaller (switch 24px, checkbox
  18px), via a transparent `::before` overlay.
- The style guide lives at `/styleguide` behind a `(styleguide)` route group; a leading-underscore folder
  is a Next.js private folder and is excluded from routing.
- **Icon names are whitelisted in `lib/validators/category.ts` and resolved only in `lib/icons.ts`.** The map
  is built at module scope and typed `Record<Name, LucideIcon>`, so a stored name can neither fail to
  resolve nor change identity between renders. A dynamic `import()` keyed on user input is never used.
- **Long dialogs cap at `max-h-[calc(100dvh-2rem)]` with a pinned action row.** `DialogContent` has no
  height cap and centres itself with `translate-y-[-50%]`, so any dialog over ~1000px pushes its own
  footer off-screen on a laptop with no way to scroll to it. Long *pages* use the same idea with a
  `fixed` action footer and matching `pb-32` on the form.
- **A validator is client code.** Nothing a file in `lib/validators/` imports may be `server-only`,
  because client forms import those schemas. Put the *rule* in a client-safe module and have the
  server service import it (`lib/membership-id.ts`), rather than the reverse. This is the same
  class of bug as the Unit 06 `cloudinary-shared` split, and it is only visible to `next build`.
- **A caller of `ConfirmDialog` cannot show an inline error.** It closes itself as soon as
  `onConfirm` settles, so any error state is unmounted before it paints. Report failures with a
  toast, or use a controlled `Dialog`.
- **`ConfirmDialog`'s `onOpenChange(false)` is ambiguous: a dismissal *or* a successful
  confirm.** Its handler runs after `onConfirm` resolves, from a closure captured when the button
  was clicked, so **every piece of state it reads is stale**. A caller that has to distinguish the
  two cases must write a **ref** synchronously inside `onConfirm`, not read state. Reading state
  is what made the reset dialog destroy the password it had just generated: the reset worked, the
  toast fired, and the dialog's own auto-close then cleared the result.
- **"This data belongs to a unit that hasn't been built" is usually the wrong conclusion — check
  the collection first.** The Unit 10 detail tabs rendered "arrives with the circulation work"
  placeholders while `Loan`, `Fine` and `Reservation` had existed since Unit 02. A confident
  empty panel is worse than an empty one, because it tells the user the app is finished here.
  Deferring a *feature* is fine; claiming there is no *data* is a separate claim, and it needs
  checking against the database.
- **A generated credential must be verified against its own validator.** A one-off alphabet with
  index ranges that do not line up produces `undefined` characters and a value that is too short,
  and neither a compiler nor an index access will complain. Generate from one module, bound the
  ranges explicitly, and prefer a rejection-sampled CSPRNG over `Math.random`.
- **Never hard-code a policy threshold in a component.** `maxActiveLoans`, `maxRenewals` and the
  fine limits are editable at runtime (invariant 7). Until a client-side settings accessor exists,
  show the number without threshold-dependent tone rather than showing it against a stale constant.
- **Derive derived state in the service, not the component.** `overdue` and `due_soon` are not
  stored (invariant 4), so any screen showing a loan has to derive them. Doing it in the render
  means the member record and the circulation desk can answer "is this late?" differently.
  Derive once in the service and put the result on the wire; keep the filter vocabulary
  (`LoanView`) and the display vocabulary (`LoanDisplayState`) as separate types, because a loan
  out on time has no filter but does have a display state.
- **A capped list must say it is capped.** Returning the newest 50 rows beside an exact total and
  rendering no note reads as "this is everything". Compare the row count against the limit.
- **A vertical action footer stacks on mobile.** `DialogFooter` is `flex-col-reverse
  sm:flex-row`, so `me-auto` (copied from `CategoryDialog`) applies to the *column* axis below
  `sm` and strands a narrow Cancel at the bottom-left instead of a full-width one. Use
  `sm:me-auto` plus `w-full sm:w-auto` on both buttons. **`CategoryDialog` still has the original
  `me-auto` and the same mobile flaw** — not fixed here to keep this commit to the rename flow,
  and worth a one-word pass at Unit 21.
- **`click({ clickCount: 3 })` does not select an input's text in headless Chrome.** Typing
  appends instead. Set the value through `HTMLInputElement.prototype`'s native setter and dispatch
  one `input` event — what testing libraries do. A harness that writes real data must also
  restore it in a `finally`.
- **Never ship `window.prompt`/`window.confirm` inside the app.** An OS dialog cannot be styled,
  so it breaks the theme at the moment of use, has no field-level validation, and discards input
  on Escape without warning. It is a console tool, not a UI.
- **Never reach for "the obvious next question" as a reason to leave a gap.** The rename dialog
  shows email and role as read-only facts *with the reason they are fixed*, rather than hiding
  them and letting the admin wonder. The same reasoning retired "promote another librarian to
  admin" — advice the app offered no way to follow — in favour of "add another administrator".
- **Two entry points to one form is a bug.** A single dialog with an explicit choice is better
  than two buttons that open it: the copy cannot drift apart, and a privileged choice stays a
  deliberate act instead of becoming a routine click.
- **Granting authority needs three things**: a default to the safe value, an explicit confirmation
  of the consequence, and an audit entry naming who authorised it. Default `role` to
  `librarian`, warn on `admin`, and let only an admin create one.
- **Prefer a native control when it already implements the accessibility contract.** A native
  radio group gives one tab stop, arrow keys and a correct tree for free. Reaching for
  `useRovingRadio` *on top of* native radios handles every arrow keypress twice. That hook is
  for styled button grids, which is what `color-swatch-picker` and `icon-picker` are.
- **A `const` referenced by an earlier module-level initialiser is a TDZ crash on import.**
  `TEAM_ROLES` sat below the schemas in `validators/members.ts`; any schema using it above would
  have failed the first time a route imported the module. Declare shared constants first.
- **One name for one list.** `STAFF_ROLES` already existed in `lib/constants.ts`, so the
  validator's `TEAM_ROLES` was a second name for the same array. Delete the duplicate rather than
  importing both.
- **Prove the sparse-index rule instead of asserting it.** Two documents with `membershipId: null`
  fail with duplicate-key `E11000` on `membershipId: 1`. An API response of
  `membershipId: null` is the `?? null` *read* fallback and is not evidence about storage — the
  stored document has to be inspected.
- **Never unmount a form's only submit button.** A form with no submit button falls into the
  implicit-submission path, where a real mouse click on a `type="button"` inside it submits anyway. Keep the
  submit button mounted and disable it instead of swapping it out. Related: `el.click()` does not
  reproduce this class of bug — use a real mouse event in the harness.
- **A dirty form must guard every close path**: Escape, the close button, Cancel and click-outside. Route
  them through one `requestClose()` so none can discard input silently. Do not nest a second modal for the
  confirmation — it strands focus inside a Radix dialog; use a pinned row instead.
- **A guard must be able to stand down for a navigation the host initiates itself.** `dirty` is React
  state and cannot be cleared synchronously, so `reset()` + `router.push()` in one tick is still
  "dirty" when Next fires `navigate`. The host calls `allowNavigation()` first, and the flag is
  cleared when the form becomes clean rather than on first use, because Next can emit more than
  one `navigate` per push.
- **`Field`'s `<label for>` must target a real control.** The pickers pass an explicit `htmlFor` (the icon
  search input, and the *selected* colour swatch — a `<button>` is a labelable element), so clicking a
  field label lands on the current control instead of dead-ending.
- **Roving tabindex is a shared hook** (`useRovingRadio`) rather than per-picker logic. Any ARIA
  `radiogroup` in this app must implement it: only the checked option is tabbable, arrows move the selection.
- **Accent-coloured surfaces use a fixed ink, never `primary-foreground`.** The category hues do not flip
  per theme, so their foregrounds must not either. See `ui-context.md` §Accent inks.
- **Never round-trip a source file through PowerShell `Get-Content -Raw` + `Set-Content`** — it reads the
  system ANSI codepage, corrupting every non-ASCII character and adding a BOM. (Also: `Get-Content`
  *display* of a UTF-8 file looks like mojibake even when the bytes are fine — check code points, not the
  console.)

## Deviations from the Original Kit
- **Next.js 16 / React 19 / Mongoose 9** instead of 15 / 19 / 8 — the scaffold and current registry
  versions. No API used by this project differs. Documented in `architecture.md`.
- **Style guide path** `/styleguide` instead of `/_styleguide` (private-folder routing rule).

## Branch Layout
- `feat/01-bootstrap-design-system` — Unit 01 + context sync.
- `feat/02-database-models` — Units 02 **and 03** (Unit 03's commit landed here before the branch was
  switched; both units are complete and verified, so history was left intact rather than rewritten).
- `feat/04-auth-ui` — Unit 04.
- `feat/05-app-shell` — Units 05, 06, 07, **08** and **09** (all on the same branch).
  - Unit 08 also fixes two Unit 02/05 defects that only became reachable now: the `isbn` /
    `membershipId` sparse-index default, and the `proxy.ts` login redirect.
  - Unit 09 adds `app/(public)/` (catalog + detail) alongside the app shell. The two
    coexist: `(public)` renders no `AppShell`, so a visitor never sees staff or member
    navigation.

## First Admin Account
Unit 07 needed a librarian to verify with, and the register endpoint only ever creates a member by design,
so an admin was inserted directly into MongoDB: **`admin@gmail.com`** (role `admin`, bcrypt cost 10
matching `lib/auth/password.ts`, and no `membershipId`, since that field's sparse unique index rejects a
stored `null`). The bootstrap script lives in the QA folder outside the repo, so the credential is not
committed. Sign in with it to reach `/staff/*`; a member is silently redirected to `/dashboard` by
`proxy.ts` rather than shown an error, which looks like a missing page.

## Session Notes
- Start every session by reading `CLAUDE.md`, then all files it lists, then the current unit spec.
- **`.next` must be deleted before each dev-server start** (`rmdir /s /q .next`). OneDrive sync turns the
  Turbopack cache into a ~150MB tree and the dev server then takes minutes to become ready or refuses with
  "Another next dev server is already running". A stale `next dev` from a killed session keeps a file handle
  and makes the delete fail — find it with
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` and stop the ones whose `CommandLine` matches
  `*next*`.
- **Never delete `.next` while a dev server is already running** — including the developer's own, outside this
  session. The process keeps the port but stops answering, so the browser shows the **404 page** on every
  route while `curl` reports a refused connection and Windows still lists port 3000 as `Listen`. That
  combination looks exactly like a routing bug and is not one. Check first with
  `Get-NetTCPConnection -LocalPort 3000 -State Listen`, and if something is there, leave it alone.
  The QA scripts in `%LOCALAPPDATA%\Temp\opencode\qa` now abort with exit code 2 in that case.
- **A 404 page's text appears in *every* page's HTML**, because `not-found.tsx` ships in the shared client
  payload. Asserting `"This shelf is empty" in html` is therefore not a 404 test — assert on the route's own
  markers (`name="email"`, `<h1>Welcome back</h1>`) instead.
- **QA runs must not assume a clean database.** A row left over from an earlier run turns a POST into a
  409, which correctly keeps the dialog open and reads exactly like a hung save. Generate a unique name per
  run (`QA ${Date.now().toString(36)}`) and delete it afterwards. Two of the "hangs" chased during the
  dialog fix were this, not the app.
- **A browser pass needs a real mouse, and real settle time.** Radix swallows `Escape` during the open
  animation, so wait ~900ms after opening a dialog before keying it; and `ElementHandle.click()` /
  `page.mouse.click()` dispatch genuine pointer events, unlike `el.click()` inside `page.evaluate`. Use the
  real ones or the harness will both miss real bugs and invent them.
- **Local MongoDB is running and `MONGODB_URI` points at it**, so units can be verified against a real
  database rather than request interception. For the browser pass, create the accounts and fixtures
  directly in Mongo (bcrypt cost 10, matching `lib/auth/password.ts`; **omit `membershipId`** on staff —
  the sparse unique index rejects a stored `null`). There is no public path to a staff account: register
  only ever makes a member, and `POST /api/team` does not arrive until Unit 10.
- **Fixtures must be deterministic across runs** — see the two notes above.
- **A background dev server dies between tool calls.** Run the server start **and** the browser check inside a
  single command, otherwise the probe hits `ERR_CONNECTION_REFUSED`. `run-unit08.ps1` in the QA folder is the
  working pattern: clean `.next` → seed fixtures → start server → poll `/api/health` → API pass → browser
  pass → audit read → stop server.
- Browser QA harness lives in `%LOCALAPPDATA%\Temp\opencode\qa` (puppeteer-core + the installed Chrome) so
  no QA dependency is added to the project.
- **Read the screenshots.** Every assertion passed on the Unit 07 pass that first revealed the truncated card
  names and the mojibake. Assert on what a user would notice — text clipping, encoding, contrast, an
  unreachable control — not only on presence and count.
- **Assert on the destination, never on a substring of the URL.** `url.includes("/login")` passes for
  `/login%3Fnext%3D…`, which is a 404. That is how a completely broken redirect survived a whole unit.
- **A page that renders a confident empty state is the most expensive kind of bug.** "No books yet ·
  0 books" over a catalog of 32 looked exactly like a correct empty list. Assert that the request fired
  and that rows exist, not that the empty state renders nicely.
- **When a check fails, dump what the user would have seen** — URL, `h1`, first 600 characters of body
  text, a screenshot, and the *named* step that was running. A bare `TimeoutError: waiting for selector`
  costs a whole debugging cycle.
- **Assert a field's content after typing it.** Character loss in a controlled/debounced input is
  invisible to every check that only asserts on the resulting URL.
- **Report partial results on a crash.** A harness that prints only on success loses the 39 checks that
  already told you which block was reached.
- **Isolate cookie jars.** Tabs in one Puppeteer browser share cookies, so an "anonymous" tab opened
  after signing in is still authenticated and the anonymous assertions silently test a signed-in user.
  Use `browser.createBrowserContext()`.
- **Auto-accept native `beforeunload` dialogs in automation.** An unanswerable native prompt blocks
  `page.goto` until it times out and the run dies with an unrelated-looking navigation error.
- **Wait for hydration before clicking.** The server-rendered form exists before React attaches; a click
  in that window is a plain native submit with no fetch and no session cookie. Wait for a
  client-only affordance, then assert you are actually signed in.
- The React Compiler rules **are** live in this project: `react-hooks/static-components` rejects a component
  resolved into a JSX tag during render, `react-hooks/refs` rejects reading a ref during render,
  `react-hooks/immutability` rejects mutating a hook argument (rename a ref to `*Ref` to make it legal),
  and `react-hooks/exhaustive-deps` requires the callback an effect calls. Build against them, not around them.
- `useReducedMotion()` returns `null` on the server but resolves on the **first client frame**, so it must
  be gated by `useIsHydrated()` or the animated markup will not match.

