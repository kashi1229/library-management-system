# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- **Phase 1 — Foundation, backend, auth, shell, profile and catalog management.**
  Units 01–08 complete. Units 09 → 21 in progress per the developer's instruction to
  complete the application rather than pause for review per unit.

## Current Goal
- Build Units 09 → 21 in dependency order (see `context/specs/00-build-plan.md`).
- Next unit: **09 — Public Catalog & Book Detail**.

## Completed

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
1. **09** Public Catalog → **10** Members & Team → **11/12** Circulation → **13** Fines →
   **14** Reservations → **15** Wishlist & Reviews → **16** Notifications → **17** Dashboards →
   **18** Reports & Audit → **19** Settings → **20** Landing & Polish → **21** Seed, QA, Docs & Deploy.

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

## In Progress
- Unit 09 — Public Catalog & Book Detail. Not started. `GET /api/books` and
  `GET /api/books/:id` are already public, URL-synced and filter/sort/paginate, so this unit is
  UI-only on the read side: the catalog grid, the filter panel, and the book detail page.

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
- `feat/05-app-shell` — Units 05, 06, 07 and **08** (all on the same branch).
  - Unit 08 also fixes two Unit 02/05 defects that only became reachable now: the `isbn` /
    `membershipId` sparse-index default, and the `proxy.ts` login redirect.

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

