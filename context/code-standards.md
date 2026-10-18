# Code Standards

## TypeScript
- `strict: true`. No `any` (use `unknown` + narrowing). No `@ts-ignore`.
- Infer types from zod: `type CreateBookInput = z.infer<typeof createBookSchema>`.
- Shared domain types live in `types/`. Lean documents typed with `LeanDoc<T>` helper; serialise ObjectId/Date to strings at the API boundary.
- Enums: define `as const` arrays in `lib/constants.ts` and derive union types.

## Naming & Files
- Files: `kebab-case.ts(x)`; components: `PascalCase` exports; hooks: `useThing`; services: `verbNoun` functions (`issueLoan`, `returnLoan`).
- One component per file. Feature components in `components/features/<feature>/`.
- Barrel files not allowed except `components/ui`.
- Max ~200 lines per component file; extract sub-components when exceeded.
- Imports use the `@/` alias to `src/`.

## Next.js
- Server Components by default. Add `"use client"` only for state, effects, event handlers, framer-motion, or browser APIs.
- Pages that need data fetch in Server Components via services directly (not through HTTP) when possible; interactive lists use client fetching against the API.
- Every route segment with data has `loading.tsx` (skeleton) and, where useful, `error.tsx`. Global `not-found.tsx`.
- Use `next/image` for Cloudinary images with `remotePatterns` for `res.cloudinary.com`; use Cloudinary URL transformations (`f_auto,q_auto,w_…`) via a `cloudinaryUrl()` helper.
- Use `metadata` exports for titles/descriptions per page.

## API Route Pattern
Every handler is wrapped by `handler()` from `lib/api.ts`, in this order:
1. `connectDB()`
2. `requireSession()` / `requireRole()` (skip for public)
3. Parse + validate with zod (body, query, params)
4. Call exactly one service function
5. Return `ok(data, meta?)`
Errors: services throw `AppError(code, message, status, fields?)`; the wrapper converts to the envelope. Unknown errors → `INTERNAL` with a generic message (log server-side).

## Services
- Pure async functions, receive typed input plus `actor` (`{ id, role }`).
- Own all rules, transactions (`withTransaction`), audit logging, and notification creation.
- Never import from `next/*`.

## Forms
- react-hook-form + zod resolver; reuse the same zod schema as the API where possible.
- Inline field errors; disable submit while submitting; success/error toast via sonner.
- Always show a loading state on buttons (spinner icon `Loader2` with spin).

## Styling
- Tailwind utilities with token classes only (`bg-background`, `text-foreground`, `border-border`, `bg-primary`, …). No raw hex/rgb in components.
- Use `cn()` (clsx + tailwind-merge). Variants via `class-variance-authority`.
- Mobile-first: base styles for 360px; `sm`, `md`, `lg`, `xl` upward. Touch targets ≥ 40px.
- Spacing on a 4px scale. Container max width 1280px (`max-w-7xl`).

## Icons
- `lucide-react` only. Default size 16–20px, stroke 1.75. Icon-only buttons require `aria-label`.

## Animation (framer-motion)
- Use shared variants from `lib/motion.ts` (`fadeUp`, `stagger`, `scaleIn`, `slideIn`). No ad-hoc timings.
- Respect `useReducedMotion()`; disable transforms when reduced.
- Animate opacity/transform only (never layout-thrashing properties).

## Accessibility
- Semantic HTML, labelled inputs, visible focus ring (`ring-2 ring-ring`), `aria-live` for toasts and async results, dialogs trap focus (Radix), colour contrast ≥ 4.5:1, full keyboard flow for tables and menus.

## Security
- bcrypt hash, JWT in httpOnly cookie, zod on all inputs, `escape` regex for search strings, never echo internal errors, rate-limit login, CSRF mitigated by SameSite=Lax + JSON-only mutation endpoints that require `Content-Type: application/json`.

## Tests
- `npm test` = `tsx --test "src/**/*.test.ts"` (Node's built-in runner; `tsx` is already a devDependency).
- Co-locate a suite as `<module>.test.ts`. No new test dependency — if a case needs a framework, use `node:test` + `node:assert/strict`.
- Test the boundary and the value a **user can see**, not the happy path: an off-by-one in a size cap is a silent policy change that `tsc` and `eslint` cannot see.

## Git & Hygiene
- Branch per unit: `feat/NN-feature-name`. Conventional commits (`feat:`, `fix:`, `chore:`).
- `.env.local` never committed; provide `.env.example`.
- ESLint + Prettier configured; `npm run lint` and `npm run build` must pass before closing a unit.
