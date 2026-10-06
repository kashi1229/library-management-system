# API Contract

Base path `/api`. JSON only. Envelope: `{ success, data, meta? }` or `{ success:false, error:{ code, message, fields? } }`.
Error codes: `UNAUTHENTICATED(401) FORBIDDEN(403) NOT_FOUND(404) VALIDATION(422) CONFLICT(409) RULE_VIOLATION(400) RATE_LIMITED(429) INTERNAL(500)`.
Pagination query: `page` (default 1), `limit` (default 12, max 100). `meta: { page, limit, total, totalPages }`.
Roles: **P** public, **M** member+, **S** staff (librarian|admin), **A** admin.

## Auth
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | /auth/register | P | Create member; set session cookie |
| POST | /auth/login | P | Verify credentials; set cookie; rate-limited (5 attempts / 10 min / IP+email, in-memory) |
| POST | /auth/logout | M | Clear cookie |
| GET | /auth/me | M | Current user (safe fields) |
| PATCH | /auth/password | M | Change own password (current + new) |

## Profile & Uploads
| PATCH | /profile | M | Update name, phone, department, avatar `{url,publicId}` (old avatar deleted from Cloudinary) |
| GET | /profile | M | Own record, safe fields |
| POST | /uploads/sign | S for `covers`, M for `avatars` | Body `{ folder: 'covers'\|'avatars' }` → `{ signature, timestamp, apiKey, cloudName, folder, allowedFormats, maxFileSizeBytes }` |
| DELETE | /uploads | S/M (owner-checked) | Body `{publicId}` remove asset |

> **The avatar `url` is derived server-side** from the `publicId`; the client-supplied `url` is ignored.
> Clients must echo back every signed field (including `max_file_size`) when POSTing to Cloudinary.

## Categories
| GET | /categories | P | List with `bookCount` (active books only) |
| POST | /categories | S | Create → `{ category }` including `bookCount` |
| PATCH | /categories/:id | S | Update → `{ category }`; re-slugs on rename. Omitted keys are left untouched |
| DELETE | /categories/:id | S | Delete → `{ id }` (blocked if **any** book references it, archived included) |

> Create and update echo `bookCount` so a client can write the response straight into its cache without
> painting an "undefined books" card until the next revalidation.

## Books
| GET | /books | P | Query: `q, category, language, availability(available\|all), yearFrom, yearTo, sort(newest\|title\|popular\|rating), status(S only), page, limit` |
| GET | /books/:slugOrId | P | Detail + `effectiveAvailable`, `queueLength`, rating summary; `userState` (`wishlisted`, `activeLoan`, `reservation`) when signed in |
| GET | /books/:id/related | P | Same category, excluding self (max 6), most-borrowed first |
| GET | /books/facets | P | Category counts + icon/accent, languages present, publication year bounds |
| POST | /books | S | Create (availableCopies = totalCopies) |
| PATCH | /books/:id | S | Update (copy-count rule enforced) |
| POST | /books/:id/archive | S | Archive / restore (`{ archived: boolean }`) |
| DELETE | /books/:id | S | Hard delete if never loaned |
| POST | /books/bulk-archive | S | `{ ids[] }` |

Notes added in Units 08–09:

- **`status` defaults to `active`** (public) and `all` (staff). The route downgrades a
  non-staff caller to `active` **in the handler**, not the service, so the rule holds for
  every caller: anonymous and member requests never see an archived book, and an archived
  book requested directly is a **404**, not a 403, so the archive is not enumerable.
- **`limit` above the documented maximum of 100 is a 422**, not silently clamped —
  `Too big: expected number to be <=100`. `page` likewise rejects `0`.
- **`PATCH`/`DELETE` require an ObjectId, not a slug.** A slug there is a client mistake
  and is reported as such (`Use the book id to update a book.`) rather than being
  silently resolved; `GET` accepts either, since the catalog links by slug.
- **An empty `PATCH` body is a 422**, so a no-op can never write an audit entry claiming
  a change. "Was a field supplied?" is tested against the raw request, so `isbn: ""`
  (clear it) and `tags: []` are still meaningful sends.
- **`POST /books/bulk-archive` is idempotent**: already-archived books come back under
  `skipped`, not as a failure, so re-running a selection is safe.
- **Copy arithmetic:** `availableCopies` moves by the *delta* of `totalCopies`. Lowering
  the total below what is out on loan is `RULE_VIOLATION` (400) naming the number.
- **`availableCopies` is not accepted on create.** The request schema does not contain
  the field, so a client cannot seed a book as "already on loan" (invariant 6).
- `POST /books/:id/archive` also accepts a **slug**; `PATCH`/`DELETE` do not.
- **`effectiveAvailable` = `availableCopies` − ready holds**, clamped to `[0, totalCopies]`.
  A copy held for a named member is not available to anyone else, so showing
  `availableCopies` would promise a book that cannot be collected (rule 6).
- **`availability=available` is filtered after the query, not in it.** The predicate spans
  two collections and a `$lookup` cannot be followed by the `skip`/`limit` Mongo needs to
  paginate correctly. Filtering after `skip`/`limit` would make `meta.total` a lie and let
  "Next" show an empty page, so the matching set is fetched, filtered, then sliced.
- **`yearFrom > yearTo` is a 422**, so an inverted range names itself instead of quietly
  matching nothing.
- **`userState` is derived from the session user id only** — never from the request body
  (invariant 3). An anonymous caller gets `{wishlisted:false, activeLoan:false,
  reservation:null}`.
- **Archived books 404** on `/books/:id` and `/books/:id/related` for non-staff, so the
  archive is not enumerable through either route.

## Members & Team
| GET | /members | S | Query `q, status, page, limit` (role=member) |
| GET | /members/:id | S | Detail + summaries |
| GET | /members/lookup | S | `q` → up to 8 lightweight results for the circulation search |
| POST | /members/:id/suspend | S | `{ reason }` |
| POST | /members/:id/activate | S | |
| POST | /members/:id/reset-password | S for members, A for librarians | Returns temporary password once |
| GET | /team | A | List librarians/admins |
| POST | /team | A | Create librarian |
| PATCH | /team/:id | A | Update name/status (cannot demote/disable self) |

## Circulation
| GET | /loans | S | Filters: `status(active|returned|overdue|due_soon), memberId, bookId, from, to, page` |
| GET | /loans/mine | M | Own loans, filter `status` |
| POST | /loans/issue | S | `{ memberId, bookId, notes? }` |
| POST | /loans/:id/return | S | Returns loan + fine (if any) |
| POST | /loans/:id/renew | M (own) / S | |

## Reservations
| GET | /reservations/mine | M | |
| GET | /reservations | S | Filters `status, bookId` |
| POST | /reservations | M | `{ bookId }` |
| DELETE | /reservations/:id | M (own) / S | Cancel |
| POST | /reservations/:id/fulfil | S | Issues the book from a *ready* reservation |

## Fines
| GET | /fines/mine | M | List + `outstandingTotal` |
| GET | /fines | S | Filters `status, memberId, from, to`; with totals |
| POST | /fines/:id/collect | S | `{ paymentMethod, note? }` |
| POST | /fines/:id/waive | S | `{ reason }` |

## Wishlist & Reviews
| GET | /wishlist | M | |
| POST | /wishlist | M | `{ bookId }` toggle-safe (idempotent add) |
| DELETE | /wishlist/:bookId | M | |
| GET | /books/:id/reviews | P | Paginated |
| POST | /books/:id/reviews | M | Create or update own `{ rating, comment }` |
| DELETE | /reviews/:id | M (own) / S | |

## Notifications
| GET | /notifications | M | `unreadOnly, page`; `meta.unreadCount` |
| POST | /notifications/:id/read | M | |
| POST | /notifications/read-all | M | |

## Dashboard, Reports, Audit, Settings, Maintenance
| GET | /dashboard/member | M | KPIs, active loans, ready holds, recommendations |
| GET | /dashboard/staff | S | KPIs, 30-day loans series, by-category, top books, recent activity, low-stock |
| GET | /public/stats | P | Books / members / loans counts + new arrivals for landing page (cached 60s) |
| GET | /reports/:type | S | `type`: `borrowing|overdue|popular|members|fines|inventory`; filters `from,to,categoryId`; `format=csv` returns text/csv |
| GET | /audit | A | Filters `actor, action, from, to, page` |
| GET | /settings/public | P | Safe subset: libraryName, loanPeriodDays, maxActiveLoans, maxRenewals, finePerDay, currencySymbol, reservationHoldHours (created in Unit 12) |
| GET | /settings | A | Full settings |
| PATCH | /settings | A | Validates numeric ranges |
| POST | /maintenance/run | A or `x-cron-secret` header | Returns counts of work done |
