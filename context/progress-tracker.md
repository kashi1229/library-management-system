# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- **Phase 1 — Foundation, backend, auth, shell and profile.** Units 01–06 complete. Units 07 → 21 in
  progress per the developer's instruction to complete the application rather than pause for review per unit.

## Current Goal
- Build Units 07 → 21 in dependency order (see `context/specs/00-build-plan.md`).
- Next unit: **07 — Categories**.

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

## Next Up
1. **07** Categories → **08** Books → **09** Public Catalog →
   **10** Members & Team → **11/12** Circulation → **13** Fines → **14** Reservations →
   **15** Wishlist & Reviews → **16** Notifications → **17** Dashboards → **18** Reports & Audit →
   **19** Settings → **20** Landing & Polish → **21** Seed, QA, Docs & Deploy.

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
- **`TextField` never padded custom controls** — `padded` was defined as `Boolean(Icon) && !Control`, so
  the `control` branch that receives `className` could never receive the padding.
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

## In Progress
- Unit 07 — Categories.

## Open Questions
- Final product name (default "Athenaeum"). Rename in Settings + `lib/constants` when Unit 19 lands.
- Default currency (default USD, editable in Settings).
- `MONGODB_URI`, `JWT_SECRET` and the three `CLOUDINARY_*` values must be in `.env.local` before the
  API can be exercised end to end. Units 03–06 are verified structurally and in the browser, but the
  live register → login → upload round trip needs a real database **and** real Cloudinary credentials.
- Confirmed against the spec: **suspended members may still edit their profile and avatar.**
  `architecture.md` §Auth & Access Model says "Wishlist and profile edits remain allowed", and
  `requireActiveMember()` is reserved for reserve / renew / issue. `PATCH /api/profile` therefore uses
  `requireSession()`, not `requireActiveMember()` — intentional, not an oversight.
- The project has **no test files**. `project-overview.md` scopes automated suites out, but the Unit 06
  pass found two HIGH bugs (broken signature, avatar never persisted) that any test would have caught.
  Worth revisiting at Unit 21.
- The browser QA harness lives outside the repo in `%LOCALAPPDATA%\Temp\opencode\qa` (puppeteer-core plus
  the installed Chrome), so no QA dependency is added to the project.

## Architecture Decisions
- Next.js 16 App Router (scaffold) + Mongoose 9 + Cloudinary signed uploads + jose JWT cookie sessions.
- Animation imports from `motion/react`; all timings live in `src/lib/motion.ts`.
- Status colours ship as `-soft` tint + `-ink` foreground pairs to satisfy WCAG 2.2 AA.
- Custom form controls receive `className` on the **input**, not a wrapper, so icon padding composes.
- Controls keep a ≥40px pointer target even when the painted box is smaller (switch 24px, checkbox 18px),
  via a transparent `::before` overlay.
- The style guide lives at `/styleguide` behind a `(styleguide)` route group; a leading-underscore folder
  is a Next.js private folder and is excluded from routing.

## Deviations from the Original Kit
- **Next.js 16 / React 19 / Mongoose 9** instead of 15 / 19 / 8 — the scaffold and current registry
  versions. No API used by this project differs. Documented in `architecture.md`.
- **Style guide path** `/styleguide` instead of `/_styleguide` (private-folder routing rule).

## Branch Layout
- `feat/01-bootstrap-design-system` — Unit 01 + context sync.
- `feat/02-database-models` — Units 02 **and 03** (Unit 03's commit landed here before the branch was
  switched; both units are complete and verified, so history was left intact rather than rewritten).
- `feat/04-auth-ui` — Unit 04.
- `feat/05-app-shell` — Units 05 and 06 (Unit 06's commit followed Unit 05 on the same branch).

## Session Notes
- Start every session by reading `CLAUDE.md`, then all files it lists, then the current unit spec.
- **`.next` must be deleted before each dev-server start** (`rmdir /s /q .next`). OneDrive sync turns the
  Turbopack cache into a ~150MB tree and the dev server then takes minutes to become ready or refuses with
  "Another next dev server is already running".
- A background dev server dies between tool calls. Run the server start **and** the browser check inside a
  single command, otherwise the probe hits `ERR_CONNECTION_REFUSED`.
- Browser QA harness lives in `%LOCALAPPDATA%\Temp\opencode\qa` (puppeteer-core + the installed Chrome) so
  no QA dependency is added to the project.
