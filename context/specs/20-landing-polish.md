# Unit 20: Landing Page & Final Polish

## Goal
A stunning data-driven landing page and a project-wide polish pass: motion, states, accessibility, SEO, and consistency.

## Design
`/` sections: (1) **Hero** — oversized Fraunces headline ("Every story, within reach."), subcopy, two CTAs (Browse catalog / Get started), a live search input that routes to the catalog, right side cluster of 5–6 real book covers floating with offset slow drift and soft shadows on a faint paper-grain background; (2) **Stats band** — books, members, loans counts with count-up (real); (3) **Categories** — horizontal scroll or grid of category cards with icon tiles; (4) **New arrivals** — carousel of latest books (drag/scroll with snap, arrow buttons); (5) **How it works** — three steps with icons (`Search`, `BookMarked`, `RotateCcw`) and connecting animated line; (6) **Call to action** band on `primary`; (7) **Footer** (3 columns, library name, contact email, links). Sticky translucent navbar with blur; hides on scroll down, shows on scroll up. Scroll-reveal animations (once).

## Implementation
- `GET /api/public/stats` (cached 60s via `revalidate`) returns counts + 8 newest active books with covers + categories.
- Landing is a Server Component using the service directly, with small client components for motion and carousel.
- **Polish checklist (apply across the app):**
  - Every page: `loading.tsx`, empty state, error boundary; global `not-found.tsx` styled.
  - Consistent page transitions, hover/focus/active states, skeleton shimmer.
  - Accessibility: skip-to-content link, landmarks, labels, focus order, contrast check (≥4.5:1) in both themes, `aria-live` for toasts, reduced-motion verified, keyboard-only walkthrough of issue/return/reserve.
  - SEO/meta: titles, descriptions, OpenGraph, favicon (Lucide `Library`-style SVG), `robots` and `sitemap` (catalog books).
  - Performance: `next/image` sizes, lazy-load below the fold, dynamic import for recharts and heavy dialogs, no layout shift.
  - Cleanup: remove `/_styleguide`, temporary scripts, unused components/dependencies, console logs.

## Dependencies
None new (embla-carousel optional but prefer native scroll-snap to avoid a dependency).

## Verify when done
- [ ] Landing shows only real data (stats, covers, categories) and every link works.
- [ ] Hero motion is smooth and disabled for reduced motion.
- [ ] Lighthouse (mobile) ≥ 90 Performance/Accessibility/Best Practices on landing and catalog.
- [ ] Keyboard-only walkthrough succeeds; skip link works.
- [ ] No page lacks loading/empty/error states; 404 page styled.
- [ ] Verified at 360, 768, 1280, 1920 px in light and dark.
- [ ] No TypeScript/ESLint/console errors · `npm run build` passes.
