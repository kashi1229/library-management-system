# Data Model (MongoDB / Mongoose)

All collections have `createdAt` and `updatedAt` (Mongoose `timestamps: true`). `_id` is ObjectId. Use `lean()` for reads in services.
Refs are ObjectIds. "(idx)" = index. Define every enum in `lib/constants.ts` and reuse in schema and zod.

## User (`users`)
| Field | Type | Notes |
|---|---|---|
| name | string, required, 2–80 | |
| email | string, required, lowercase, **unique idx** | |
| passwordHash | string, required, `select:false` | bcrypt, cost 10 |
| role | enum `admin|librarian|member`, default `member` (idx) | |
| membershipId | string, unique sparse idx | Generated for members only: `LIB-YYYY-NNNN` using a `counters` collection (atomic `$inc`). **The field must be absent on staff records — a stored `null` counts as a value and trips the unique index** |
| phone | string, optional | |
| department | string, optional | e.g. "Computer Science" |
| avatar | `{ url, publicId }` optional | Cloudinary |
| status | enum `active|suspended`, default `active` (idx) | |
| suspendedReason | string optional | |
| lastLoginAt | Date optional | |

> **`membershipId` has no `default`.** A sparse unique index skips documents where the
> field is *absent*; a stored `null` is a value. With a default, every staff account
> would collide on `membershipId_1` and the second librarian ever created would fail
> with a bare `E11000`. Readers use `user.membershipId ?? null`. Fixed in Unit 08 —
> the bug was latent until `POST /api/team` (Unit 10) had a way to create staff.

## Counter (`counters`)
`{ _id: string (e.g. "membership-2026"), seq: number }` — atomic sequence generator.

## Category (`categories`)
| name (unique) | slug (unique idx) | description | icon (Lucide icon name string, default "BookOpen") | color (token key: `forest|terracotta|ocean|plum|ochre|slate`) |

> `icon` is validated against the **curated whitelist** `CATEGORY_ICON_NAMES` in
> `lib/validators/category.ts` (42 names), and `color` against `CATEGORY_COLORS`. The whitelist is the only
> source: `lib/icons.ts` builds its name→component map from it at module scope, so a stored icon can never
> fail to resolve. Deletion is blocked while **any** book references the category (archived included, to
> avoid a dangling ref), even though `bookCount` in `GET /api/categories` counts active books only.

## Book (`books`)
| Field | Type | Notes |
|---|---|---|
| title | string required, 2–200 (text idx) | |
| slug | string unique idx | from title + short id suffix |
| authors | string[] required, ≥1 (text idx) | |
| isbn | string, unique sparse idx | Stored normalised (digits/X, no hyphens); validate ISBN-10/13 checksum. **No `default`** — see below |
| publisher | string optional | |
| edition | string optional | |
| publishedYear | number optional (1000..currentYear+1) | |
| language | string default "English" (idx) | |
| category | ref Category required (idx) | |
| tags | string[] (text idx) | lowercase |
| description | string, ≤2000 | |
| pageCount | number optional (1..10000) | |
| cover | `{ url, publicId }` optional | Cloudinary |
| shelfLocation | string optional, ≤20 | e.g. "A-12-3" |
| totalCopies | number ≥1 | |
| availableCopies | number ≥0, ≤ totalCopies | System-managed |
| status | enum `active|archived` default `active` (idx) | |
| ratingAvg | number default 0 | Derived, maintained |
| ratingCount | number default 0 | Derived, maintained |
| borrowCount | number default 0 (idx) | Incremented on issue |
| addedBy | ref User | |

Text index: `{ title, authors, tags, isbn }` weights title 5, authors 3, tags 2, isbn 4. Compound idx `{ status, category, createdAt }`.

> **`isbn` has no `default`,** for the same reason `User.membershipId` does not: a
> sparse unique index treats an absent field as absent but a stored `null` as a
> value, so a default would mean only **one** book in the whole catalog could lack an
> ISBN and the second would fail with `E11000 duplicate key … isbn_1`. `createBook`
> omits the key when there is no ISBN; `updateBook` assigns `undefined` (Mongoose
> `$unset`s it) to clear one. Readers see `book.isbn ?? null`.
>
> Every length/range cap here must **match `lib/validators/book.ts` exactly.** They
> disagreed in Unit 08 (title 300 vs 200, shelf 40 vs 20, pageCount unbounded vs
> 10000), which meant the validator accepted input the schema rejected and the user
> saw a generic 500 instead of a field error.
>
> Every list sort ends in a **unique tiebreaker** (`_id`). Books created together share
> a `createdAt` to the millisecond, so sorting on `createdAt` alone leaves ties to
> Mongo and is not stable between queries — page 1 and page 2 of the same filter could
> return the same row and skip another.

## Loan (`loans`)
| book (ref, idx) | member (ref, idx) | issuedBy (ref User) | issuedAt (Date) | dueDate (Date, idx) | returnedAt (Date, null) | receivedBy (ref User, null) | renewCount (number default 0) | status enum `active|returned` (idx) | fineAmount (number default 0) | notes (string) |
Compound idx `{ member, status }`, `{ book, status }`. Partial unique idx on `{ book, member }` where `status='active'` (prevents duplicate active loan).

## Fine (`fines`)
| loan (ref unique) | member (ref idx) | book (ref) | daysOverdue (number) | ratePerDay (number) | amount (number) | status enum `unpaid|paid|waived` (idx) | paidAt (Date) | collectedBy (ref User) | paymentMethod (enum `cash|card|other`) | waivedBy (ref User) | reason (string) | note (string) |

## Reservation (`reservations`)
| book (ref idx) | member (ref idx) | status enum `waiting|ready|fulfilled|cancelled|expired` (idx) | readyAt | expiresAt | fulfilledLoan (ref Loan) | cancelledBy (ref User) |
Partial unique idx `{ book, member }` where status in (`waiting`,`ready`). Queue order = `createdAt` ascending among `waiting`.

> No field was added or changed in Unit 14. What changed is **who owns the rules around them**:
> the queue mechanics moved into `lib/services/hooks.ts` (`getReadyHoldCounts`,
> `promoteReservationQueue`, `fulfilReadyReservationIfAny`, `countOtherReservations`) as the
> leaf that both `circulation.ts` and `reservations.ts` depend on, and the FIFO ordering moved
> into `activeQueuePositions` in `lib/services/reservations.ts` as the single reader for three
> callers. See `architecture.md` for why the first split was unavoidable and the second was
> pure deduplication.
>
> A reservation **outlives its book** in practice: the `Reservation` collection has no FK
> enforcement, and `deleteBook` refuses while active holds exist but earlier QA deleted books
> directly in Mongo. Readers must therefore tolerate a missing book — `bookRefOr` returns a
> "No longer in the catalog" placeholder with an **empty `slug`**, and an empty slug is the
> signal that the row must not be rendered as a link.

## Wishlist (`wishlists`)
`{ member ref, book ref }`, unique compound idx `{ member, book }`.

- **The unique index is what makes the write idempotent.** A double-click or a retried request
  finds the row instead of inserting a second one, so `POST /wishlist` can succeed on an
  already-saved book rather than conflicting (Unit 15).

## Review (`reviews`)
`{ book ref idx, member ref idx, rating 1..5, comment string ≤1000 }`, unique compound `{ book, member }`.

- **The unique index expresses business rule 9's companion rule — one review per member per
  book — so it is enforced by the database, not by a check-then-insert in the service.** That
  check would lose a race between two simultaneous posts. The service handles the collision by
  *adopting and editing* the row the winner created, rather than returning an error to a
  request that succeeded in substance (Unit 15).
- **`comment` is stored as `null`, never `""`.** The validator trims, so a whitespace-only
  comment would otherwise be persisted as an empty string and the collection would hold two
  representations of "rated it, wrote nothing". The UI renders *"No comment left."* for both.
- **`Book.ratingAvg` / `ratingCount` are denormalised aggregates**, recomputed in the same
  transaction as the write from an aggregation over the collection — not adjusted from the row
  in hand, which a concurrent write would invalidate.

## Notification (`notifications`)
`{ user ref idx, type enum, title, message, link (string optional), readAt (Date|null), dedupeKey (string unique sparse) }`, idx `{ user, readAt, createdAt:-1 }`.
Types: `loan_issued, loan_returned, loan_renewed, due_soon, overdue, fine_created, fine_paid, fine_waived, reservation_ready, reservation_expired, reservation_cancelled, account_suspended, account_activated, new_reservation`.

## AuditLog (`auditlogs`)
`{ actor ref User, action string (e.g. "loan.issue"), entityType string, entityId ObjectId, summary string, meta object }`, idx `{ createdAt:-1 }`, `{ actor }`, `{ action }`. Never updated or deleted.

## Setting (`settings`, singleton `key:"global"`)
| libraryName "Athenaeum" | contactEmail | loanPeriodDays 14 | maxActiveLoans 5 | maxRenewals 2 | renewalExtensionDays 7 | finePerDay 5 | maxFinePerLoan 250 | fineBlockThreshold 100 | reservationHoldHours 48 | maxReservationsPerMember 3 | currencyCode "USD" | currencySymbol "$" | lastMaintenanceAt (Date) |

## Relationships (ER summary)
- User 1—N Loan, Fine, Reservation, Wishlist, Review, Notification
- Category 1—N Book
- Book 1—N Loan, Reservation, Review, Wishlist
- Loan 1—0..1 Fine
- Reservation 0..1—1 Loan (fulfilledLoan)
- User(staff) 1—N AuditLog
