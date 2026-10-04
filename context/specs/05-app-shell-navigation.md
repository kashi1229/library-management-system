# Unit 05: App Shell & Navigation

## Goal
Role-aware application shell shared by member and staff areas: sidebar, topbar, mobile drawer, bottom tab bar, user menu, breadcrumbs, and placeholder pages for every route so navigation can be verified end to end.

## Design
Per `ui-context.md` Layout Patterns. Sidebar 264px (collapsible to 72px icon rail with tooltips, state remembered in localStorage), active item has a `primary` soft background with an animated pill (framer-motion `layoutId`). Topbar: breadcrumb/page title (serif), search trigger, bell (static for now), theme toggle, avatar menu. Under 1024px sidebar is a left Sheet; under 768px member area shows a bottom tab bar with 5 items and an active indicator.

## Implementation

### Layouts
- `(member)/layout.tsx`: loads session user server-side; renders `AppShell variant="member"`.
- `staff/layout.tsx`: requires staff role server-side (redundant with middleware); renders `AppShell variant="staff"`; admin-only items hidden for librarians.
- `useCurrentUser` client context provider hydrated from the server user (no extra fetch).

### Components (`components/layout`)
- `AppShell`, `Sidebar` (sections: Main / Manage / Admin), `SidebarItem`, `Topbar`, `Breadcrumbs`, `MobileNav` (Sheet), `BottomTabBar`, `UserMenu` (avatar, name, role badge, membership ID; items Profile, Theme, Sign out), `NotificationBell` (static, count 0 for now).
- Suspended banner: if `status==='suspended'`, show a dismiss-proof warning bar under the topbar explaining restrictions.
- Logout calls `/api/auth/logout`, then navigates to `/login` with toast.

### Routes & placeholders
Create pages (each with `PageHeader` + `EmptyState` "Coming in a later unit" placeholder, `loading.tsx` skeleton):
- Member: `/dashboard, /my-loans, /reservations, /wishlist, /fines, /notifications, /profile`.
- Staff: `/staff, /staff/circulation, /staff/books, /staff/categories, /staff/members, /staff/reservations, /staff/fines, /staff/reports, /staff/team, /staff/audit, /staff/settings`.
- Global `not-found.tsx` (serif "Page not found", link home) and `error.tsx`.

### Nav config
- `lib/constants.ts` exports `MEMBER_NAV`, `STAFF_NAV`, `ADMIN_NAV` (label, href, Lucide icon, roles) per ui-context.

## Dependencies
None new.

## Verify when done
- [ ] Member sees only member nav; librarian sees staff nav without admin items; admin sees all.
- [ ] Direct URL to a forbidden page redirects correctly.
- [ ] Sidebar collapse, drawer, and bottom tab bar all work and animate; active states correct.
- [ ] Theme toggle and sign-out work from the user menu.
- [ ] Suspended banner shows for a suspended test user.
- [ ] Layout intact at 360px, 768px, 1280px, light and dark.
- [ ] No TypeScript errors · No console errors · `npm run build` passes.
