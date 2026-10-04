# Unit 08: Books Management (Staff)

## Goal
Complete book CRUD for staff with Cloudinary covers, copy-count rules, archive/restore, safe delete, search/filter/sort/pagination, and bulk archive.

## Design
`/staff/books`: toolbar (search input with `Search` icon, category select, status tabs Active/Archived/All, sort menu, "Add book" button). DataTable columns: cover thumbnail, title + authors, ISBN (mono), category chip, copies "available/total" with a thin progress bar, shelf, status badge, actions menu. Under 768px rows become stacked cards. Bulk select checkbox bar slides up with "Archive selected". Create/Edit pages `/staff/books/new` and `/staff/books/[id]/edit`: two-column form (left: ImageUploader 2:3 cover with live BookCover preview; right: fields in grouped sections Basic Info, Publication, Inventory), sticky footer with Cancel/Save.

## Implementation

### Validators
`lib/validators/book.ts`: title (2–200), authors (array ≥1, each ≤80; input as tag-style chips), isbn (optional; normalised; ISBN-10/13 checksum validator), publisher, edition, publishedYear (1000..current+1), language (select + other), category (required id), tags (chips, ≤10, lowercase), description (≤2000), pageCount (1..10000), shelfLocation (≤20), totalCopies (1..999), cover `{url,publicId}`.

### Service (`lib/services/books.ts`)
- `listBooks(filters, actor)` — staff see all; builds query from `q` (text search with regex fallback for partial titles/ISBN), category, status, sort, pagination; populates category summary.
- `getBook`, `createBook` (availableCopies = totalCopies; slug generation; ISBN unique check; audit), `updateBook` (if `totalCopies` changes: `newAvailable = availableCopies + (newTotal − oldTotal)`; reject if result < 0 with message "N copies are currently on loan"; audit with diff summary), `setArchived`, `deleteBook` (blocked if any loan exists; deletes Cloudinary cover), `bulkArchive`.
- Routes per `api-contract.md`.

### UI
- `BookForm` (shared by new/edit), `TagInput` (chips), `AuthorsInput`, `BooksTable`, `BookRowActions`, `BulkBar`, `CopiesBar`.
- ISBN field shows live validity icon; duplicate ISBN → field error.
- Unsaved-changes guard on navigation.

## Dependencies
None new.

## Verify when done
- [ ] Create a book with cover → appears in table with correct copies.
- [ ] Editing total copies recalculates `availableCopies` correctly; lowering below on-loan count is rejected.
- [ ] Invalid ISBN checksum rejected; duplicate ISBN rejected.
- [ ] Archive/restore works; archived hidden from default Active tab.
- [ ] Delete works only for never-loaned books and removes the Cloudinary asset.
- [ ] Search matches title, author, ISBN, tags; filters, sort, pagination work and persist in URL.
- [ ] Bulk archive works; members get 403 on all mutation routes.
- [ ] Responsive (table → cards); light/dark OK.
- [ ] No TypeScript errors · No console errors · `npm run build` passes.
