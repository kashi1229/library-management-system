# UI Context — "Parchment & Ink"

**Aesthetic:** warm, editorial, minimal, quietly artistic — like a well-designed reading room. Generous whitespace, large serif headings,
soft paper-like surfaces, thin borders, one deep-forest primary and one terracotta accent. Motion is gentle and purposeful.
Never glossy, never cluttered, never neon.

## Color Tokens (CSS variables; Tailwind maps them to semantic classes)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | #FAF7F2 | #14120F | Page background (paper) |
| `surface` (`card`) | #FFFFFF | #1C1A16 | Cards, panels, popovers |
| `surface-muted` (`muted`) | #F3EEE6 | #25221D | Subtle fills, table headers, inputs hover |
| `border` | #E6DFD3 | #34302A | Dividers, outlines |
| `input` | #E6DFD3 | #34302A | Input borders |
| `foreground` | #1C1917 | #F2EDE4 | Primary text (ink) |
| `muted-foreground` | #6B645A | #A39B8E | Secondary text |
| `primary` | #1F3D36 | #7FB5A3 | Main buttons, active nav, links |
| `primary-foreground` | #FAF7F2 | #10201B | Text on primary |
| `accent` | #C2703D | #E08A57 | Highlights, badges, hover accents |
| `accent-soft` | #F4E4D6 | #3A2A1F | Accent tinted backgrounds |
| `ring` | #1F3D36 | #7FB5A3 | Focus ring |
| `success` | #2F7D5B | #5BBF93 | Available, paid, on-time |
| `warning` | #C98A1B | #E3A93A | Due soon, waiting |
| `danger` | #B4412F | #E8705D | Overdue, errors, destructive |
| `info` | #3B6E8F | #6FA6C8 | Informational |

Each status color also has a `-soft` variant (≈12% tint) for badge backgrounds.
**Category accent keys:** `forest #1F3D36`, `terracotta #C2703D`, `ocean #3B6E8F`, `plum #6B3E5E`, `ochre #C98A1B`, `slate #4A5560` (used for generated covers and category chips).

## Typography
| Role | Font | Notes |
|---|---|---|
| Display & headings | **Fraunces** (variable, opsz) | Weights 500–700; tight tracking (-0.02em) |
| Body & UI | **Inter** | 400/500/600 |
| IDs, ISBN, codes | **JetBrains Mono** | 12–13px |

Scale: Hero `clamp(2.5rem, 6vw, 4.5rem)`; H1 `2.25rem`; H2 `1.75rem`; H3 `1.25rem`; body `1rem`; small `0.875rem`; caption `0.75rem`. Line-height 1.6 body, 1.1–1.2 headings.

## Radius, Shadow, Spacing
- Radius: `sm 6px`, `md 10px` (inputs/buttons), `lg 14px` (cards), `xl 20px` (hero panels, modals), `full` (avatars, pills).
- Shadows: `shadow-soft` (0 1px 2px rgba(28,25,23,.05), 0 8px 24px -12px rgba(28,25,23,.12)); `shadow-lift` on hover (0 12px 32px -12px rgba(28,25,23,.22)). In dark mode shadows are replaced by 1px borders + slight surface lightening.
- Spacing: 4px base. Section padding `py-16 md:py-24`; card padding `p-5 md:p-6`.

## Motion Language
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`. Durations: fast 150ms (hover), base 250ms (UI), slow 450ms (page/hero).
- **Page transition:** fade + 8px rise. **Lists:** stagger children 40ms. **Cards:** hover lifts 2px + shadow-lift. **Buttons:** press scales to 0.98. **Dialogs/Sheets:** scale-in 0.97→1 / slide from edge. **Counters:** KPI numbers count up once on view. **Heart (wishlist):** spring pop + fill. **Bell:** subtle shake on new notification. **Skeletons:** soft shimmer. **Hero:** book covers float with slow, offset sine drift (transform only).
- `prefers-reduced-motion`: disable transforms/drift; keep opacity fades ≤150ms.
- Never animate more than 2 things competing for attention at once.

## Component Conventions
- **Buttons:** variants `default` (primary), `secondary` (surface-muted), `outline`, `ghost`, `accent`, `destructive`; sizes `sm/md/lg/icon`. Leading Lucide icon optional.
- **Inputs:** 44px height, border `input`, focus ring `ring`, label above, helper/error text below in `muted-foreground`/`danger`.
- **Cards:** `surface`, `border`, radius `lg`, `shadow-soft`.
- **Badges (StatusBadge):** pill, soft tinted background + colored text + small dot. Mapping: `available`=success, `low`=warning (≤1 copy), `unavailable`=danger, `on_time`=success, `due_soon`=warning, `overdue`=danger, `returned`=muted, `waiting`=warning, `ready`=info, `fulfilled`=success, `expired/cancelled`=muted, `unpaid`=danger, `paid`=success, `waived`=muted, `active`=success, `suspended`=danger.
- **BookCover:** 2:3 ratio, radius `md`, subtle inner border and spine highlight on the left edge (CSS gradient). Fallback: gradient from category color + serif title initials + author line.
- **DataTable:** sticky header, zebra off, row hover `muted`, sortable headers, pagination footer, responsive: converts to **stacked cards under 768px**.
- **Dialogs:** confirm destructive actions with ConfirmDialog (title, consequence text, danger button).
- **Toasts:** sonner, bottom-right (top-center on mobile), icon by type.
- **Empty states:** centered Lucide icon in an `accent-soft` circle, serif headline, one sentence, primary action.
- **Skeletons** match final layout.

## Layout Patterns
- **Marketing/public:** sticky translucent navbar (logo left; Catalog, About links; theme toggle; Sign in / Get started or avatar menu). Footer with 3 columns.
- **App shell (member + staff):** left **Sidebar** 264px on ≥1024px (collapsible to 72px icon rail with tooltip labels); **Topbar** with page title/breadcrumb, global search (staff: books/members), notification bell, theme toggle, avatar menu. Under 1024px: sidebar becomes a **Sheet drawer** opened by a hamburger; member area additionally has a **bottom tab bar** (Home, Catalog, Loans, Wishlist, Profile) under 768px.
- **Page structure:** `PageHeader` (serif H1, muted description, right-aligned primary action) → content in `max-w-7xl` container with `space-y-8`.
- **Auth pages:** two panels ≥1024px (left: form; right: parchment panel with large serif quote and softly drifting book spines illustration built from CSS shapes). Mobile: form only with small logo.
- **Catalog:** left filter column (sticky) on desktop; filters in a bottom Sheet on mobile. Grid: 2 cols (mobile) → 3 → 4 → 5.
- **Book detail:** two-column (cover sticky left, info right) ≥768px; stacked on mobile; action bar becomes sticky bottom bar on mobile.
- **Forms:** single column on mobile, two columns on `md+`; sticky action footer for long forms.

## Navigation Items (Lucide icons)
**Member:** Dashboard `LayoutDashboard`, Catalog `Library`, My Loans `BookMarked`, Reservations `Clock`, Wishlist `Heart`, Fines `Receipt`, Notifications `Bell`, Profile `UserRound`.
**Staff:** Dashboard `LayoutDashboard`, Circulation `ArrowLeftRight`, Books `BookOpen`, Categories `Tags`, Members `Users`, Reservations `Clock`, Fines `Receipt`, Reports `BarChart3`, then Admin-only: Team `ShieldCheck`, Audit Log `ScrollText`, Settings `Settings`.
**Common icons:** Search `Search`, Add `Plus`, Edit `Pencil`, Delete `Trash2`, Archive `Archive`, Upload `ImagePlus`/`UploadCloud`, Filter `SlidersHorizontal`, Sort `ArrowUpDown`, Menu `Menu`, Close `X`, Theme `Sun`/`Moon`, Logout `LogOut`, Success `CheckCircle2`, Warning `AlertTriangle`, Error `XCircle`, Info `Info`, Download `Download`, Star `Star`, Calendar `CalendarDays`, Loading `Loader2`, Chevrons `ChevronLeft/Right/Down`, More `MoreHorizontal`.

## Responsive Breakpoints
360 (min supported) · `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 · `2xl` 1536.

## Quality Bar
Pixel-aligned, consistent spacing, no layout shift on load (reserve image space), no horizontal scroll, text never truncated without tooltip/ellipsis, hover/focus/active/disabled states on all interactives.
