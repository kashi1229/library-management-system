# Unit 09: Public Catalog & Book Detail

## Goal
A fast, beautiful public catalog with search, filters, sorting, pagination, and a rich book detail page. Visitors can browse; action buttons prompt sign-in.

## Design
`/catalog`: header with serif title and a large search field. Desktop: sticky filter column left (Category list with counts and icons, Language, Availability toggle "Available now", Year range). Mobile: "Filters" button opens a bottom Sheet. Toolbar: result count, grid/list toggle (`LayoutGrid`/`List`), sort select. Grid 2→3→4→5 columns; BookCard = cover (hover lifts, quick availability pill overlay), title (2-line clamp), author, rating stars, availability badge. List mode = horizontal rows with description snippet. Staggered entry; skeleton grid while loading.
`/catalog/[slug]`: breadcrumb; sticky cover left with soft shadow and subtle tilt on hover; right column: category chip, serif title, authors, rating summary, metadata grid (ISBN, publisher, year, edition, language, pages, shelf), availability panel ("3 of 5 available" with segmented dots, or "All copies out · 2 waiting"), action bar (Reserve / Add to wishlist / Share), description with "read more", reviews placeholder section, "More in this category" carousel. Mobile: sticky bottom action bar.

## Implementation

### API/Service
- `GET /api/books` public: only `active` books; params `q, category, language, availability, yearFrom, yearTo, sort, page, limit(12)`; returns `effectiveAvailable` per book (availableCopies minus ready holds — at this stage ready holds = 0 until Unit 14; implement through `getReadyHoldCounts(bookIds)` helper stub returning zeros).
- `GET /api/books/:slugOrId`: detail + `queueLength` (stub 0) + `userState` when signed in (`wishlisted`, `activeLoan`, `reservation` stubs false/null until later units).
- `GET /api/books/:id/related`.
- Facet endpoint data: category counts and available languages from `GET /api/books?facets=1` or a dedicated `GET /api/books/facets`.

### Client
- Filters state synced to URL search params (shareable); debounced search (300ms); `useSWR` with keepPreviousData.
- `BookCard`, `BookGrid`, `BookList`, `CatalogFilters`, `FilterSheet`, `SortSelect`, `ViewToggle`, `AvailabilityBadge`, `StarRating` (read-only), `BookActions` (buttons render by auth state: visitor → "Sign in to reserve"; wiring to later units, buttons disabled-with-tooltip until built).
- Detail page server-rendered with `generateMetadata` (title, description, OpenGraph cover).
- Not-found for unknown slug or archived book (visitors).

## Dependencies
None new.

## Verify when done
- [ ] Search, each filter, sort, pagination, grid/list toggle all work and persist in the URL.
- [ ] "Available now" filter excludes books with zero available copies.
- [ ] Detail page shows correct data, availability, related books; archived books 404 for visitors.
- [ ] Skeleton, empty ("No books match your filters" + Clear filters), and error states exist.
- [ ] Mobile filter sheet and sticky action bar work; no horizontal scroll at 360px.
- [ ] Images use `next/image` with Cloudinary transformations; no layout shift.
- [ ] Light/dark OK · No TypeScript/console errors · `npm run build` passes.
