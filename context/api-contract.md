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
| GET | /books | P | Query: `q, category, language, availability(available\|all), yearFrom, yearTo, sort(newest\|title\|popular\|rating), status(S only), page, limit`. Every book carries `wishlisted` — `false` for an anonymous caller (Unit 15) |
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
  reservation:null, reservationId:null, reservationPosition:null, readyHoldHours:null}`.
- **Archived books 404** on `/books/:id`, `/books/:id/related` and `/books/:id/reviews` for
  non-staff — and on `/reviews` for **everyone**, staff included, so the archive is not
  enumerable through any of the three.
- **`wishlisted` on the list is resolved in one query from the session** (Unit 15), not per
  book. It is a required field on `CatalogBook`, so a serialiser that omitted it would fail
  to type-check rather than quietly render twenty unsaved hearts.
- **The availability badge says "None available", not "All N out"** (Unit 14). The `available`
  it receives is already `effectiveAvailable`, so on a two-copy book with one copy on loan and
  the other held for somebody, "All 2 out" is false — one of them is on a shelf with a name on
  it — while "none available" is true from the reader's side, which is what the badge is for.

## Members & Team
| GET | /members | S | Query `q, status, page, limit` (role=member) |
| GET | /members/:id | S | Detail + summaries |
| GET | /members/lookup | S | `q` → up to 8 lightweight results for the circulation search |
| POST | /members/:id/suspend | S | `{ reason }` |
| POST | /members/:id/activate | S | |
| POST | /members/:id/reset-password | S for members, A for librarians | Returns temporary password once |
| GET | /team | A | List librarians/admins |
| POST | /team | A | Create a staff account. Body `{ name, email, password, phone?, role? }`; `role` defaults to `librarian`, and only an admin may send `admin` |
| PATCH | /team/:id | A | Update name/status. `role` is rejected, so a librarian cannot be promoted — create an administrator instead |

## Circulation
| GET | /loans | S | Filters: `q, status(active|returned|overdue|due_soon), memberId, bookId, from, to, page, limit`. `status` is the **derived** view and is optional, so no filter means all loans |
| GET | /loans/mine | M | Own loans, filter `status`. No member id is accepted — it comes from the session |
| POST | /loans/issue | S | `{ memberId, bookId, notes? }`. `bookId` accepts an id **or** a slug. 201. Every policy refusal is a 400 `RULE_VIOLATION` naming the rule and, where it helps, the field |
| POST | /loans/:id/return | S | Returns the loan plus `fine` (or `null` when on time). A second return is a 400 |
| POST | /loans/:id/renew | M (own) / S | Extends by `renewalExtensionDays`. A member renewing someone else's loan is a 403 |

All three mutations run in a Mongo transaction, so they need a **replica set** (Atlas
provides one; a standalone local `mongod` does not — see the progress tracker).

## Public settings
| GET | /settings/public | — | Display-safe policy subset: `libraryName, loanPeriodDays, maxActiveLoans, maxRenewals, renewalExtensionDays, finePerDay, currencySymbol, reservationHoldHours`. **Unauthenticated** — a member needs the loan period to read their own countdown. Deliberately excludes `contactEmail`, `fineBlockThreshold`, `maxFinePerLoan` and `lastMaintenanceAt`

## Reservations
| GET | /reservations/mine | M | Own holds, **already grouped** into `{ ready, waiting, past, pastTotal }`. No query parameters: the schema has none |
| GET | /reservations | S | Filters `status` (comma-separated list, optional), `bookId`, `page`, `limit` |
| POST | /reservations | M (active member) | `{ bookId }`. 201. Suspended members are refused |
| DELETE | /reservations/:id | M (own) / S | Cancel. Cancelling a **`ready`** hold releases the copy and promotes the queue |
| POST | /reservations/:id/fulfil | S | Requires `ready`. Issues the book from the hold and closes it **in one transaction**; returns `{ reservation, loan }` |

Notes added in Unit 14:

- **`status` accepts a comma-separated list** (`?status=waiting,ready`). A single-value
  enum is not enough: the staff History tab is three states (`fulfilled,cancelled,expired`)
  and must be one paginated request, because a tab assembled from three calls is a lie the
  moment one of them fails. Every token is checked against `RESERVATION_STATUSES`, so a typo
  is a 422 naming the valid values rather than an empty table.
- **`/mine` returns the three groups already built**, plus `pastTotal` beside the capped
  `past`, so the UI can say "the 50 most recent of 340". Grouping in the client would drop
  rows the moment a member had more than one page of history — which is what "Past" always is.
  It takes **no member id** and **no filters**: the schema has neither, so editing the URL
  cannot reach somebody else's queue.
- **Every refusal names the rule that fired.** The four reserve refusals are checked
  specific-before-general: *already on loan* → *already reserved* → *reservation limit* (with
  both numbers) → *copies are available, visit the desk*. A member who both holds the book
  and is looking at a free copy satisfies two rules, and only the specific one tells them
  what to fix.
- **A staff account calling `POST /reservations` gets 403, not 400.** It is a role question,
  not a business rule.
- **`DELETE` is authorised in the service, not the route** — the owner and staff are both
  allowed, and comparing the reservation's member against the session id is what tells them
  apart (invariant 3). A member cancelling someone else's hold is 403.
- **`cancel` and `fulfil` are terminal.** A second attempt is a 400 naming the state, not a
  silent no-op.
- **`hoursUntilExpiry` is server-derived and rounded up**, and is `null` unless `status` is
  `ready`. Rounded up because the alternative is "0 hours left" while a copy is still on the
  shelf. The client never recomputes it.
- **`queuePosition` is non-null only while `waiting`.** A `ready` hold is *counted* in the
  FIFO order (so the first person still waiting is #2) but carries no number of its own;
  giving it one would label two members #1 on the same book.
- **An automatic expiry writes no audit row.** `logAudit` requires an actor and there is
  none — the clock did it. Inventing a "system" user is the bug Unit 13 hit. The
  `ready → expired` state change plus the member's `reservation_expired` notification is the
  record. `reservation.create` / `.cancel` / `.fulfil` **are** audited.
- **A reservation whose book has been deleted still renders**, with `bookRefOr`'s
  "No longer in the catalog" placeholder and an empty `slug`. The UI must not link it: an
  empty slug in an href lands on `/catalog/`, which is a different page, not the book.
- `GET /books/:id` gained `userState.reservationId`, `.reservationPosition` and
  `.readyHoldHours` so the detail page can cancel and count down without a second request,
  and without a second implementation of the FIFO or rounding rules in a component.

## Fines
| GET | /fines/mine | M | List + `outstandingTotal` |
| GET | /fines | S | Filters `q, status, memberId, bookId, from, to`; with totals |
| POST | /fines/:id/collect | S | `{ paymentMethod, amount, note? }` |
| POST | /fines/:id/waive | S | `{ reason }` |

- `amount` is **required and must equal `fine.amount` exactly** — a smaller amount (part
  payment) and a larger one (overpayment) are both refused. `Fine` carries no `amountPaid`
  or change field, so there is nowhere to record either. Collect and waive are **terminal**:
  re-running either on a settled fine is a 4xx, not a silent no-op. `reason` is required on
  waive and must be 3–500 characters.
- `GET /fines` totals are computed across **all** fines, not the filtered page, so paging and
  filtering cannot change the figures on the KPI cards.

## Wishlist & Reviews
| GET | /wishlist | M | `items[]` of full `CatalogBook`; member from session only |
| POST | /wishlist | M | `{ bookId }` idempotent add; archived book refused |
| DELETE | /wishlist/:bookId | M | Idempotent; member from session only |
| GET | /books/:id/reviews | P | Paginated; `summary` over **all** reviews + `mine` |
| POST | /books/:id/reviews | M | Create or update own `{ rating 1-5, comment? }` |
| DELETE | /reviews/:id | M (own) / S | Returns the recomputed `summary` |

- **The member is resolved from the session and there is no member id in any payload.** A
  `memberId` query param on `/wishlist` is ignored; editing the URL cannot read somebody
  else's reading list.
- **Both wishlist writes are idempotent.** Re-saving a saved book and re-removing a removed
  one both succeed rather than conflicting, because a double-click and a retried request are
  the same event from the client's point of view.
- **`POST /books/:id/reviews` upserts.** There is no separate edit route: a second post for
  the same member and book edits the existing row, enforced by the
  `review_one_per_member_book` unique index. A 409 "you already reviewed this" would be the
  wrong answer for the one person the feature exists to serve.
- **Eligibility is any loan of that book in any state**, including a returned one. Refused
  with a 400 naming the action; a suspended member is refused as suspended.
- **`summary.average` is rounded to one decimal**, `summary.count` is the real total, and
  `summary.distribution` is **five integers with index 0 = one star**. All three are aggregated
  over the whole collection, so `?limit=2` returns the same summary as the full page.
- **`mine` is returned on every page**, so the composer can offer an edit without scanning
  the visible rows; it is `null` for an anonymous caller.
- **An archived book 404s on `/books/:id/reviews` for everyone**, staff included.
- **Staff removal is audited** with `moderated: true` and the average and count the book was
  left at; a member deleting their own review writes the same action with `moderated: false`.

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
