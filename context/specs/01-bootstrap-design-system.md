# Unit 01: Project Bootstrap & Design System

## Goal
Create a running Next.js 15 + TypeScript + Tailwind app with the complete Parchment & Ink design system: tokens, fonts, light/dark theme, base UI components, motion helpers, and a visual "style guide" page proving everything works.

## Design
Follow `ui-context.md` exactly: color tokens (light/dark), Fraunces/Inter/JetBrains Mono, radius and shadow scales, motion language.

## Implementation

### Project setup
- `create-next-app` (TypeScript, ESLint, Tailwind, App Router, `src/` dir, `@/*` alias). Strict TS. Prettier config. `.env.example` listing all env vars from README. `.gitignore` includes `.env*.local`.
- Folder skeleton per `architecture.md` (empty folders with `.gitkeep` where needed).

### Tokens & theme
- Define all tokens as CSS variables in `globals.css` for `:root` and `.dark`; map to Tailwind semantic colors (`background, foreground, card, muted, border, primary, accent, success, warning, danger, info`, plus `-soft` and `-foreground` variants), radii, shadows (`shadow-soft`, `shadow-lift`).
- `next-themes` provider (class strategy, default `system`), `ThemeToggle` (Sun/Moon with animated swap).
- Fonts via `next/font` with CSS variables `--font-display`, `--font-sans`, `--font-mono`. Headings use display font globally.
- Global base: smooth scroll, selection color `accent-soft`, custom thin scrollbars, focus-visible ring.

### Base UI kit (shadcn/ui, restyled by tokens)
Install and configure: Button, Input, Textarea, Label, Select, Checkbox, Switch, Badge, Card, Dialog, AlertDialog, DropdownMenu, Sheet, Tabs, Tooltip, Popover, Separator, Skeleton, Avatar, Table, Pagination (custom), Form helpers.
Create in `components/common`: `PageHeader`, `EmptyState`, `StatCard` (count-up), `StatusBadge` (status → color map per ui-context), `ConfirmDialog`, `BookCover` (with generated fallback), `Logo` (Lucide `Library` mark + serif wordmark), `Spinner`.

### Utilities
- `lib/utils.ts` (`cn`, `formatDate`, `formatCurrency`, `initials`), `lib/constants.ts` (roles, statuses, category colors, nav config placeholders), `lib/motion.ts` (`fadeUp`, `stagger`, `scaleIn`, `slideIn`, spring presets, reduced-motion helper), `cloudinaryUrl()` helper stub (no network).
- `Toaster` (sonner) mounted in root layout.

### Style guide page
- Temporary route `/_styleguide` (only in development: returns 404 in production) showing colors, type scale, buttons, inputs, badges, cards, dialog, skeleton, empty state, toasts, book cover fallback, motion demos.

## Dependencies
next, react, typescript, tailwindcss, tailwind-merge, clsx, class-variance-authority, lucide-react, framer-motion, next-themes, sonner, date-fns, zod, shadcn/ui (via CLI; Radix packages), prettier.

## Verify when done
- [ ] `npm run dev` runs; `/_styleguide` renders all components in light and dark.
- [ ] Fonts load via next/font with no layout shift.
- [ ] Theme toggle persists and respects system default.
- [ ] No raw hex colors in any component (only tokens).
- [ ] Reduced-motion setting disables transforms.
- [ ] Responsive at 360px, 768px, 1280px.
- [ ] No TypeScript errors · No console errors · `npm run build` passes.
