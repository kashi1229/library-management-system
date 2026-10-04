# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- **Phase 1 — Foundation & core backend.** Unit 01 complete; the full remaining build is in progress per the
  developer's instruction to complete the application rather than pause for review after each unit.

## Current Goal
- Build Units 02 → 21 in dependency order (see `context/specs/00-build-plan.md`).
- Next unit: **02 — Database & Models**.

## Completed
### Unit 01 — Bootstrap & Design System ✅
- Restructured to `src/` with the `@/*` → `./src/*` alias, matching `architecture.md`.
- **Parchment & Ink tokens** in `src/app/globals.css`: full light + dark palettes, radii (`sm/md/lg/xl`),
  `shadow-soft` / `shadow-lift`, type scale, category accents, and `-soft` + `-ink` status pairs
  (new tokens, see `ui-context.md`), mapped to Tailwind through one `@theme inline` block.
- **Fonts** via `next/font` — Fraunces (display), Inter (body), JetBrains Mono (codes) in `src/lib/fonts.ts`.
- **Theme**: `next-themes` provider (class strategy, `system` default) + animated `ThemeToggle`.
- **Base UI kit**: 23 shadcn/ui primitives restyled onto the tokens, plus `Field`
  (label/control/helper/error) and root `not-found.tsx`.
- **`components/common`**: `PageHeader`, `EmptyState`, `StatCard` (+`StatCardSkeleton`, count-up),
  `StatusBadge` (full ui-context status→tone map), `ConfirmDialog`, `BookCover` (2:3 + generated fallback),
  `Logo` (+`InitialAvatar`), `Spinner` (+`LoadingPanel`).
- **`src/lib/motion.ts`**: `motionTokens`, `transitions`, `springs`, `fadeUp`/`stagger`/`scaleIn`/`slideIn`
  and their `*Reduced` counterparts. `src/hooks/use-motion-variants.ts` exposes the reduced-motion helpers
  built on `useSyncExternalStore` (React 19 safe).
- **`src/lib/utils.ts`** (`cn`, `formatDate`, `formatCurrency`, `initials`), **`src/lib/constants.ts`**
  (all domain enums, routes, nav config), **`src/lib/cloudinary.ts`** (`cloudinaryUrl()` offline builder).
- **Style guide** at `/styleguide` (dev-only, hard-404 in production).
- Tooling: `components.json`, `.prettierrc.json`, `.env.example`, Cloudinary `remotePatterns`, root
  `not-found.tsx`, folder skeleton from `architecture.md`.

**Unit 01 verification (headless Chrome, `/styleguide` + `/` + 404):**
- [x] `npm run dev` runs; style guide renders in light **and** dark.
- [x] Fonts load via `next/font`, 3 faces preloaded, **CLS = 0.0000** at 360 / 768 / 1280px.
- [x] Theme toggle persists across reload and respects the system default.
- [x] No raw hex in components — verified by grep and by resolved computed styles.
- [x] Reduced motion disables transforms (0 transformed elements observed).
- [x] Responsive at 360px, 768px, 1280px with no horizontal overflow.
- [x] **0 console errors, 0 page errors, 0 failed requests** at every breakpoint.
- [x] No TypeScript errors · `npm run lint` clean · `npm run build` passes.
- [x] Text contrast ≥ 4.5:1 for body, muted, accent and caption text (led to the new `-ink` tokens).
- [x] Pointer targets ≥ 40px (led to `sm` button `h-10`, `h-12` tab track, switch `::before` hit area).
- [x] `/styleguide` returns 404 in a production build.

## In Progress
- Unit 02 — Database & Models.

## Next Up
1. **02** Database & Models — `db.ts`, 12 Mongoose models, settings singleton, `api.ts` helpers.
2. **03** Auth API & route protection — jose JWT cookie, middleware, role guards.
3. **04** Auth UI → **05** App Shell → **06** Cloudinary & Profile → **07** Categories →
   **08** Books → **09** Public Catalog → **10** Members & Team → **11/12** Circulation →
   **13** Fines → **14** Reservations → **15** Wishlist & Reviews → **16** Notifications →
   **17** Dashboards → **18** Reports & Audit → **19** Settings → **20** Landing & Polish →
   **21** Seed, QA, Docs & Deploy.

## Open Questions
- Final product name (default "Athenaeum"). Rename in Settings + `lib/constants` when Settings (Unit 19) lands.
- Default currency (default USD, editable in Settings).

## Architecture Decisions
- Next.js 16 App Router (scaffold) + Mongoose + Cloudinary signed uploads + jose JWT cookie sessions.
- Overdue is derived, never stored. Ready reservations hold a copy. Maintenance job is lazy/on-demand (no cron required).
- Business policy values live in the Settings singleton.
- Animation imports from `motion/react` (framer-motion v12+ package rename); all timings live in `src/lib/motion.ts`.
- Status colours ship as `-soft` tint + `-ink` foreground pairs to satisfy WCAG 2.2 AA.
- The style guide lives at `/styleguide` behind a `(styleguide)` route group: a leading-underscore folder is a
  Next.js private folder and is excluded from routing, so `app/_styleguide/` was never reachable.

## Deviations from the Original Kit
- **Next.js 16 instead of 15** — the scaffold already shipped 16.3.8; App Router APIs used here are identical.
  Documented in `architecture.md`.
- **Style guide path** — `/styleguide` instead of `/_styleguide`, for the private-folder reason above.

## Session Notes
- Start every session by reading `CLAUDE.md`, then all files it lists, then the current unit spec.
- `npm run dev` must be the only Next process; a stale `next dev` holds a lock in `.next/dev` and the next
  start will refuse with "Another next dev server is already running".
