# Unit 07: Categories

## Goal
Full category management for staff and a public categories endpoint used by catalog filters and the landing page.

## Design
Staff page `/staff/categories`: responsive card grid (each card shows colored icon tile, name, description, book count, edit/delete in a `MoreHorizontal` menu) with a prominent "New category" button. Create/Edit in a Dialog: name, description, icon picker (searchable grid of ~40 curated Lucide icons), color picker (six category tokens as swatches). Cards animate in with stagger; delete shows ConfirmDialog.

## Implementation

### Validators/Service/API
- `lib/validators/category.ts`: name (2–40, unique), description (≤200), icon (from curated whitelist), color (one of 6 keys).
- `lib/services/categories.ts`: `listCategories()` (with `bookCount` via aggregation counting only `active` books), `createCategory`, `updateCategory` (re-slug on rename), `deleteCategory` (RULE_VIOLATION "Reassign or archive its N books first" when books exist). All mutations audited.
- Routes: `GET /api/categories` (public), `POST`, `PATCH /:id`, `DELETE /:id` (staff).

### UI
- `components/features/categories/*`: `CategoryCard`, `CategoryDialog`, `IconPicker` (dynamic Lucide icon rendering from a name→component map in `lib/icons.ts` restricted to the whitelist), `ColorSwatchPicker`.
- Client list uses SWR with optimistic updates; empty state "No categories yet — create the first shelf."
- Seed-friendly: default icon `BookOpen`, default color `forest`.

## Dependencies
swr.

## Verify when done
- [ ] Create, edit, delete work; duplicate names show a field error.
- [ ] Deleting a category with books is blocked with an explanatory message.
- [ ] Icon and color pickers update the card preview live.
- [ ] Member/visitor calls to mutation routes return 403/401.
- [ ] Audit entries are written for each mutation.
- [ ] Responsive grid (1→2→3→4 cols); light/dark OK.
- [ ] No TypeScript errors · `npm run build` passes.
