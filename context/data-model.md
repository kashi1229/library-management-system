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
| membershipId | string, unique sparse idx | Generated for members only: `LIB-YYYY-NNNN` using a `counters` collection (atomic `$inc`) |
| phone | string, optional | |
| department | string, optional | e.g. "Computer Science" |
| avatar | `{ url, publicId }` optional | Cloudinary |
| status | enum `active|suspended`, default `active` (idx) | |
| suspendedReason | string optional | |
| lastLoginAt | Date optional | |

## Counter (`counters`)
`{ _id: string (e.g. "membership-2026"), seq: number }` — atomic sequence generator.

## Category (`categories`)
| name (unique) | slug (unique idx) | description | icon (Lucide icon name string, default "BookOpen") | color (token key: `forest|terracotta|ocean|plum|ochre|slate`) |

## Book (`books`)
| Field | Type | Notes |
|---|---|---|
| title | string required (text idx) | |
| slug | string unique idx | from title + short id suffix |
| authors | string[] required, ≥1 (text idx) | |
| isbn | string, unique sparse idx | Stored normalised (digits/X, no hyphens); validate ISBN-10/13 checksum |
| publisher, edition | string optional | |
| publishedYear | number optional (1000..currentYear+1) | |
| language | string default "English" (idx) | |
| category | ref Category required (idx) | |
| tags | string[] (text idx) | lowercase |
| description | string, ≤2000 | |
| pageCount | number optional | |
| cover | `{ url, publicId }` optional | Cloudinary |
| shelfLocation | string optional | e.g. "A-12-3" |
| totalCopies | number ≥1 | |
| availableCopies | number ≥0, ≤ totalCopies | System-managed |
| status | enum `active|archived` default `active` (idx) | |
| ratingAvg | number default 0 | Derived, maintained |
| ratingCount | number default 0 | Derived, maintained |
| borrowCount | number default 0 (idx) | Incremented on issue |
| addedBy | ref User | |

Text index: `{ title, authors, tags, isbn }` weights title 5, authors 3, tags 2, isbn 4. Compound idx `{ status, category, createdAt }`.

## Loan (`loans`)
| book (ref, idx) | member (ref, idx) | issuedBy (ref User) | issuedAt (Date) | dueDate (Date, idx) | returnedAt (Date, null) | receivedBy (ref User, null) | renewCount (number default 0) | status enum `active|returned` (idx) | fineAmount (number default 0) | notes (string) |
Compound idx `{ member, status }`, `{ book, status }`. Partial unique idx on `{ book, member }` where `status='active'` (prevents duplicate active loan).

## Fine (`fines`)
| loan (ref unique) | member (ref idx) | book (ref) | daysOverdue (number) | ratePerDay (number) | amount (number) | status enum `unpaid|paid|waived` (idx) | paidAt (Date) | collectedBy (ref User) | paymentMethod (enum `cash|card|other`) | waivedBy (ref User) | reason (string) | note (string) |

## Reservation (`reservations`)
| book (ref idx) | member (ref idx) | status enum `waiting|ready|fulfilled|cancelled|expired` (idx) | readyAt | expiresAt | fulfilledLoan (ref Loan) | cancelledBy (ref User) |
Partial unique idx `{ book, member }` where status in (`waiting`,`ready`). Queue order = `createdAt` ascending among `waiting`.

## Wishlist (`wishlists`)
`{ member ref, book ref }`, unique compound idx `{ member, book }`.

## Review (`reviews`)
`{ book ref idx, member ref idx, rating 1..5, comment string ≤1000 }`, unique compound `{ book, member }`.

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
