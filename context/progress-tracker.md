# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- **Phase 1 — Foundation, backend, auth, shell, profile, catalog management, public catalog, members/team, circulation, fines, reservations, wishlist/reviews.**
  Units 01–15 complete. **Unit 16 in progress** (see the WIP section below). Units 17 → 21 to go.

## Current Goal
- Build Units 17 → 21 in dependency order (see `context/specs/00-build-plan.md`).
- **Unit 16 is committed as WIP with one known defect** — `POST /api/maintenance/run`
  intermittently aborts its transaction. The fix is to finish; see the WIP section for exactly
  what has been narrowed down and what has not.
- **Unit 17 (Dashboards) can start on what is already here**: `StatCard` takes an optional
  `format`, `GET /api/settings/public` exists, and `runMaintenanceIfDue()` already runs from the
  staff layout.

## Completed

### Unit 16 — Notifications & Maintenance · `feat/16-notifications` 🚧 **WIP — one known defect**
**Status: committed incomplete on the developer's instruction, so Unit 17 can proceed.** Not
verified end to end. `tsc`, `eslint` and `next build` are clean; the browser pass was at 29/29
before the maintenance transaction was touched. **Do not treat the maintenance job as working.**

- **Known defect — `POST /api/maintenance/run` intermittently 500s** with
  `MongoServerError: Transaction with { txnNumber: N } has been aborted`.
  - **Narrowed to:** the interaction between `claimRun`'s conditional write to the `settings`
    document and `getSettings()`'s **upsert** — which also writes `settings` — being called
    from inside `promoteReservationQueue`, which runs inside the expiry transaction. Two writes
    to one document inside one transaction.
  - **Not proved.** A faithful reimplementation of the expiry sequence commits fine against the
    local replica set, and the raw `settings` upsert inside a transaction commits fine. So the
    hypothesis is not yet confirmed, and **two attempts to fix it were wrong**: one edited a dev
    server that was running stale code (it never picked the change up and produced a 500 that
    looked like a new bug), and one only added a comment without changing any behaviour. The
    lesson is in the code comment at `hooks.ts` §`promoteReservationQueue`, but the fix itself
    is not done.
  - **Next step, concretely:** make `promoteReservationQueue` read `reservationHoldHours`
    **without** the upsert — a plain `Setting.findOne(...).select(...)` — or pass the hold hours
    in from the caller, which maintenance already reads outside any transaction. That removes
    the second write to `settings` from inside the transaction and is the most likely fix.
- **`lib/services/notifications.ts` — the real `notify()`, plus `listNotifications`,
  `getLatestForPopover`, `getUnreadCount`, `markRead`, `markAllRead`.**
  - **`notify` never throws into its caller.** A notification is a courtesy about an event that
    already happened; a duplicate is the *expected* result of a re-run, not an error.
  - **The spec says "swallow duplicate-key errors from `dedupeKey`", and that instruction cannot
    be followed inside a transaction — so it was deliberately not followed, and the reason is
    recorded in the code.** MongoDB aborts the whole transaction on *any* write error, so
    catching `E11000` and returning normally leaves the caller inside a transaction that is
    already dead: every later write fails with *"Transaction has been aborted"* and the commit
    fails too. A "handled" duplicate therefore silently destroys the rest of the unit of work.
    **Reproduced directly against the local replica set** before the change: one duplicate
    insert, then a normal insert in the same transaction — the second one throws.
    - So a `dedupeKey` is now **read before the insert**, in the caller's session so it sees the
      same snapshot. The unique index stays as the guarantee, and the `E11000` catch is retained
      for the concurrent-insert race, where there is no transaction to poison.
  - **`comment`-style care: `dedupeKey` is omitted, never `null`.** The index is **sparse**, and
    a stored `null` is a value — every one-off notification would collide with every other.
  - **`unreadCount` is counted over the whole inbox, not the page.** A badge that counts only the
    twelve rows on screen reads "3 unread" while the member has eleven, and the number on the
    bell is the number they will believe.
  - **`markRead` is scoped by `{ _id, user }`.** The id alone is not authorisation. "Does not
    exist" and "not yours" are deliberately the same answer, because distinguishing them tells a
    prober which ids are real.
- **`lib/notification-templates.ts` — icon and tone per type, as a total `Record`.** Adding a
  type to `NOTIFICATION_TYPES` without drawing it here is a **compile error**, not a blank tile
  (the `CATEGORY_ICON_NAMES` argument from Unit 07). Client-safe by design: no `server-only`, no
  mongoose — the Unit 10 lesson about a client-safe/server split.
  - **The spec's template map for the *copy* was deliberately not built**, and the reasoning is
    in the file. The copy is written at each call site because that is where the values are:
    `fines.ts` has `daysOverdue` and `amount`, `hooks.ts` has `expiresAt`. A builder map turns
    *"“Kindred” was returned 4 days late. You owe $20.00."* into a function taking fifteen
    named arguments — the same words with more indirection. The drift that matters is two call
    sites wording the same event differently, which a map does not prevent either.
- **Routes**: `GET /api/notifications`, `POST /api/notifications/:id/read`,
  `POST /api/notifications/read-all`, `POST /api/maintenance/run`.
  - **`requireSession()` throughout, not `requireActiveMember()`.** A suspended member may still
    read, and the notification they were sent — including the notice that they were suspended —
    is part of that.
  - **There is no member id in any notification payload or query**, so editing the URL cannot
    reach somebody else's inbox.
  - **`mark-all-read` is one `updateMany`, not a loop** — the inbox is the one collection a
    member can legitimately accumulate unboundedly.
- **`POST /api/maintenance/run` — admin session *or* `x-cron-secret`, decided independently.**
  The role check runs **first**, so a signed-in member cannot be upgraded by adding a header.
  `getSession()` rather than `requireAdmin()` because the two callers are alternatives, not a
  sequence: an unauthenticated cron request must not fail as "not signed in" before the secret
  is considered.
  - **`isValidCronSecret` uses `timingSafeEqual`, not `===`** (`lib/cron-secret.ts`) — a plain
    comparison returns at the first differing character and leaks how much of a guess was right.
    **Absent is not "allow"**: with no `CRON_SECRET` the secret path is closed, leaving only the
    admin session, because "unset means no check" is how an unauthenticated maintenance endpoint
    reaches production.
  - **The cron path writes no audit row.** There is no user, and inventing a "system" actor is
    the mistake Units 13 and 14 made on the automatic fine and the automatic hold expiry.
- **Throttling is claimed before the work, with a conditional update**, so exactly one caller
  wins and the losers report `skipped: true` rather than failing. Also `runExclusive`, a
  module-level promise chain, because the settings claim cannot stop two requests *inside one
  Node process* from overlapping — and the staff layout fires a sweep on every page load, so that
  happens constantly. **Both mechanisms are needed and neither is sufficient alone**, which is
  worth writing down because "it has a throttle" sounds like the whole story.
- **`NotificationBell`** — 60s `refreshInterval` (SWR already knows how to poll; a hand-rolled
  interval keeps fetching after the tab closes), count over the whole inbox, and a 0.7s shake
  when the count rises. **The shake is explicitly disabled under `prefers-reduced-motion`** while
  the badge remains, because the information must not depend on the motion being seen.
  - **The badge is `aria-hidden`** — the count is already in the trigger's label, and announcing
    it twice makes a screen reader say the number as two separate items.
- **`/notifications`** — All / Unread tabs, **grouped by day** (Today / Yesterday / dated), with
  the year dropped only for the current year. Clicking a row marks it read *and* navigates, and
  the mark is optimistic so the row dims immediately rather than after a round trip.
  - **The row is a `<button>`, not a link**, because mark-read is part of the action and an
    `<a>` cannot promise it.
- **Staff fan-out on reserve** — every librarian is notified that a book is being waited for,
  once per book per day. Notifying one named librarian makes the other three look at an empty
  register; notifying each new joiner produces four notices for the first person. Not inside the
  creating transaction, so a failed notice cannot fail the reservation.
- **`DUE_SOON_DAYS = 3` is a named constant, not Settings.** It is a property of "soon" in a
  14-day loan rather than library policy; invariant 7 covers policy numbers an admin may
  reasonably change, and the answer to "why three?" should be a grep.
- **Verified before the transaction work:** the browser pass reached **29/29** — the badge counts
  the inbox rather than the popover's six rows, day grouping separates Today from Yesterday from
  another year, clicking a row both navigates and marks read, the Unread tab matches the badge,
  reduced motion disables the shake while keeping the count, and a suspended member can still
  read. Screenshots in `%LOCALAPPDATA%\Temp\opencode\qa\notifications-*.png`.

### Unit 15 — Wishlist & Reviews ✅ · `feat/15-wishlist-reviews`
- **The last unwired control in the app is now wired.** The heart on the book detail page
  shipped in Unit 09 rendering `disabled` with a `title` naming the unit that would open it;
  it is now a real optimistic toggle, and it is also on every catalog card.
- **`lib/services/wishlist.ts`** — `listWishlist`, `addToWishlist`, `removeFromWishlist`.
  Saves and removals are **idempotent** and resolve the member from the session, so
  `/wishlist?memberId=<someone else>` lists your own list and `DELETE /wishlist/:bookId` can
  only remove your own row. The scope is the *session member*, and the schema has no member
  field to get wrong.
  - **The wishlist list is built from the catalog reader**, so a saved book arrives as the
    same `CatalogBook` the catalog card renders — same `effectiveAvailable`, same cover, same
    category tint. A second serialiser for the same book would eventually disagree with the
    first, and the disagreement would show as a save whose availability differs from the page
    it was saved from.
  - **An archived book cannot be saved**, refused with a sentence naming the reason, and the
    unique index means a double-click cannot create two rows.
- **`lib/services/reviews.ts`** — `listReviews`, `upsertReview`, `deleteReview`, plus
  `recomputeBookRating`.
  - **The review write and the book's aggregate move in one transaction.** A rating row
    committed without `Book.ratingAvg`/`ratingCount` would leave a book whose card says
    "No ratings" directly above a page listing four reviews. `recomputeBookRating` reads from
    the aggregation, not from the row in hand, so a second concurrent write cannot leave the
    average counting a review that is not there.
  - **One review per member per book, enforced by the index and honoured by the service.** A
    second `POST` **edits** the existing row rather than adding a second one — same `_id`,
    same `updatedAt`. There is no separate edit route, because the second post *is* the edit,
    and a member who has already reviewed is exactly the case where a "you already reviewed
    this" 409 would be the wrong answer.
    - **The race is handled by adopting the row, not by failing.** Two clicks can both pass
      the "have they reviewed it" check; the loser's insert violates the unique index and the
      service then *finds and edits* the row the winner just created. A request that succeeded
      in substance should not return a failure.
  - **The eligibility rule is a loan in any state, not a current loan.** The refusal message
    names the action: *"Borrow … before leaving a review, so your rating means something."*
    A member who borrowed and returned the book is exactly who the rule exists to include.
  - **Suspended members can read reviews but not publish them** (`requireActiveMember`),
    matching the confirmed rule that suspension stops borrowing, not reading.
  - **`mine` is returned on every page of reviews**, not derived from the visible rows. The
    composer needs the caller's own review to offer an edit, and reconstructing it client-side
    would be a second implementation that fails silently for anyone with more than one page of
    reviews — showing an empty composer that quietly creates a duplicate.
  - **The distribution is aggregated over the whole collection, not the page.** Deriving it
    from the ten visible reviews would make the bars change as a reader pages, which reads as
    the ratings themselves changing. Verified explicitly: the same `?limit=2` request returns
    the same five bars as the full one.
  - **An empty comment is stored as `null`, not `""`.** The validator trims, so whitespace
    became `""` and the collection held two representations of "rated it, wrote nothing".
    Found by an assertion that expected `null`. One representation, decided once, in the
    service.
  - **Staff removal is audited as moderation, and the member's own deletion is not.**
    `moderated: true` plus the reviewer's member id and the average the book was *left* at —
    the consequence a reader cannot reconstruct from the log afterwards. A member deleting
    their own review writes the same action with `moderated: false`, so the audit trail
    distinguishes "a librarian removed this" from "the writer took it back".
- **Routes**: `GET/POST /api/wishlist`, `DELETE /api/wishlist/[bookId]`,
  `GET/POST /api/books/[id]/reviews`, `DELETE /api/reviews/[id]`. Reviews are **public on
  read** — the summary is the thing a visitor came for — and writes are member-only.
  `DELETE /api/reviews/[id]` authorises **in the service** (owner or staff, 403 otherwise),
  because both are allowed and only the review's own member tells them apart.
  - **An archived book 404s on `/reviews` for everyone, staff included**, so the archive is
    not enumerable through this route.
- **`CatalogBook` gained a required `wishlisted`, resolved in one query** by `serialiseAll`
  from the cookie session rather than per-card. It was previously optional and computed for
  the detail page only; a catalog grid of twenty cards cannot ask twenty questions. Because it
  is required, `withAvailability` now sets it to `false` explicitly and the comment says why
  that value is always overwritten — a field that satisfies a type but is never read is how the
  next caller forgets to fill it.
- **The star picker is five native radio inputs**, not styled buttons with an ARIA
  radiogroup. The browser already implements one tab stop, arrow keys and the correct
  accessibility tree. Hover and focus **preview** the rating without committing it, which is
  the behaviour a reader expects from a star field and is invisible to a keyboard user.
- **No heart at all for a visitor**, on either the card or the detail page. A grid of hearts
  that all answer "sign in" is a wall of controls that cannot be used, and it makes the feature
  look broken on the one page every visitor judges the site by. A visitor is told *"Sign in to
  rate"* instead, which is the sentence that actually applies to them.
- **`/wishlist`** — a grid of saved books with the real cover, availability, and a Reserve
  button **only where it can work** (nothing free and the book is active). A disabled Reserve
  costs the reader a decision and says "not now" without saying why.
- **"Write a review" on My Loans History** deep-links to `/catalog/[slug]#reviews` rather than
  opening a dialog here: reviewing is the one member action that needs the rating summary and
  the existing reviews beside it. Guarded on `book.slug`, because `bookRefOr` returns `slug: ""`
  for a deleted book and `href="/catalog/#reviews"` would take the member to a 404 from a button
  labelled "review" — the same bug Unit 14 found in the staff register.
- **Verified against the live local MongoDB: 67/67 API checks and 55/55 browser checks, 0 page
  errors, 0 console errors**, at 390 / 768 / 1280 px in light and dark. `tsc`, `eslint` and
  `next build` clean; all four routes and the page present in the build output.
  - **The aggregate is proved as arithmetic, not as "a number appeared".** The fixture seeds a
    known spread — five 5s, one 4, one 3, sum 32 over 7 — and the average (4.6), the count and
    all five bars are asserted as numbers, then re-asserted at `?limit=2` to prove the summary
    is not computed from the page. After a 1-star review: `4.4 / 8`, and the collection holds
    eight reviews, not nine.
  - **The keyboard path is driven with the keyboard**: focus the first radio, two `ArrowRight`
    presses, and the third is selected — then hover a fifth star and confirm the choice did
    not move.
- **Deliberately not done:**
  - **No staff reviews register.** Staff moderation happens on the book page, where the
    review and the thing it is about are the same screen. A separate list of every review in
    the library is not something the spec asks for and is not something a librarian does.
  - **No review edit/delete route pair** — a second `POST` is the edit, and `DELETE` covers
    both cases with the service deciding which.
  - **No helpful-vote on reviews.** Not in the spec.
  - **The browser pass did not run the earlier Playwright harness.** Playwright was not in the
    project and downloading a browser was cut short by the developer, so the pass uses
    **puppeteer-core with the installed Chrome** — the harness Units 06–14 already used, so no
    project dependency is added.

### Unit 15 — bugs found by the API pass
- **A whitespace-only comment was stored as `""` instead of `null`.** The validator trims, so
  `"   "` became `""`, and the collection then held two ways of saying "rated it, wrote
  nothing". Every `if (review.comment)` check would have had to know about both. Normalised
  once in the service, with a comment saying why.
- **`withAvailability` stopped type-checking** the moment `wishlisted` became required on
  `CatalogBook`, which `tsc` caught immediately — recorded because the fix is instructive
  rather than because it was subtle: the field is set to `false` there and *always*
  overwritten by `serialiseAll`, and that is now stated in the comment so the next caller does
  not treat it as meaningful.

### Unit 15 — bugs found by reading the screenshots
Found the way Unit 07's truncated category names were found: **every assertion passed while the
layout was wrong**, because no assertion looked at the rendered row.

- **At 390px a review row tore into three lines** — name, then stars, then the date on its own.
  The stars and the date describe the same review, and wrapping them independently makes one
  fact look like three. They are now a single `whitespace-nowrap` group that wraps together or
  not at all. Only visible at 390px with a long enough name; the 1280px screenshot was correct.

### Unit 15 — harness lessons
- **A fixture that violates a database rule is caught by the database, not by the pass.** The
  first `bootstrap15` gave one member two reviews of the same book and Mongo refused the whole
  insert with `E11000 … review_one_per_member_book`. That is the rule working; the fixtures had
  to give each reviewer their own.
- **A stored average does not round-trip, so never reconstruct a total from it.** The first
  version of the pass computed the expected average as `(4.6 × 7 + 1) / 8`, which is not what
  the code does: `4.6` is the *rounded* value, `4.6 × 7 = 32.2` and the reviews actually sum to
  32. Asserting on the reconstruction would fail a correct implementation. The total is now
  tracked as an **integer** and the average derived from it.
- **A wrong hand-written `DISTRIBUTION` looks exactly like a real bug.** One seeded 4 and one
  seeded 3 is `[0,0,1,1,5]`, and the constant said `[0,0,0,1,5]`. Reading the documents in
  Mongo directly settled it in one query rather than an argument.
- **Documents written by the app carry no fixture marker.** Deleting by `__qa15` left a
  member's review behind from the previous run and it collided with the unique index on
  re-seed. The previous run's user ids are recorded in `qa15_state` so API-created rows can be
  found by member — the Unit 14 lesson, in a second unit.
- **Take the element you mean, not the first one on the page.** `clickHeart` originally clicked
  the first heart, and since the fixture had two books saved the pass began by *removing* one
  and then asserted the count had gone up. It now selects by `aria-pressed`.
- **An accessible name with typographic quotes does not survive a Puppeteer selector.**
  `[aria-pressed*="reading list" i]` worked for `$eval` and failed for `page.click`, because the
  selector reached the browser with its inner quotes stripped. Selecting the node inside the
  page and clicking it is immune.
- **`element.click()` is not a real click.** The My Loans History tab did not respond to a
  synthetic `.click()` from `page.evaluate`, so the "Write a review" link appeared to be missing
  — the exact Unit 07 lesson, where `el.click()` also failed to reproduce a real interaction.
  `tab.click()` as an ElementHandle does.
- **A harness must not report success on the way down.** An exception escaping the `try` printed
  "all browser checks passed" from `finally` and then exited non-zero. A thrown error is now a
  failed check.
- **Assert on the accessible name, not on visible text, for an icon button.** The moderation
  control is a trash icon; its `aria-label` is the entire signal. Matching `textContent` found
  nothing and read as "staff have no moderation control".
- **The API pass and the browser pass each need their own seed.** They mutate the same
  fixtures, so running both against one seed makes the second fail on data the first changed.
  `run-unit15.ps1` re-seeds between them.

### Unit 14 — Reservations ✅ · `feat/14-reservations`
- **The queue is live end to end.** A member reserves from the book detail page, a returned copy
  promotes the longest-waiting hold, the hold counts down, a librarian fulfils it and the member
  gets a loan — or collects one at the desk and the hold closes there instead.
- **`promoteReservationQueue` and `fulfilReadyReservationIfAny` are real.** The Unit 11 stubs are
  gone; both take a `session`, because they are called from inside `withTransaction` and a hook
  that opened its own connection would write outside the transaction.
  - **Free copies are `availableCopies - readyHolds`, not `availableCopies`.** Counting only the
    physical copies is the bug that hands the same book to three people: two copies already
    promised to named members are spoken for and the queue has to see them as such. The loop
    promotes as many as there are free copies (a bulk reshelving frees three at once), and it
    cannot spin, because each iteration either promotes a hold or stops.
  - `fulfilReadyReservationIfAny` writes **no audit row**. The caller is `issueLoan`, which already
    writes `loan.issue` and records `fulfilledHold` in its metadata; a second row would give one
    event two audit entries.
- **`lib/services/reservations.ts`** — `reserveBook`, `cancelReservation`, `fulfilReservation`,
  `expireStaleReservations`, `listReservations`, `listMyReservations`, `getQueueInfo`,
  `activeQueuePositions`, `hoursUntil`. Every policy number comes from `getSettings()` at request
  time (invariant 7); there is no `3` or `48` literal in the file.
- **The four reserve refusals are checked specific-before-general**, on the Unit 12 lesson:
  *already have this on loan* → *already reserved* → *reservation limit* (both numbers) → *copies
  are available, visit the desk*. A member who both holds the book and is looking at a free copy
  satisfies two of the rules, and only the specific one tells them what to fix. The last check is
  also the permissive one, so it is the last one — the other three are single indexed queries.
- **`fulfilReservation` needed a real refactor, and MongoDB is why.** `reservations.ts` must import
  `circulation.ts` (fulfilling issues a loan) while `circulation.ts` needs the queue primitives,
  so putting those primitives in `reservations.ts` is a cycle. They went into `hooks.ts` as a
  leaf, the same reason `refs.ts` exists — documented in `architecture.md` §Service layering.
  And because **MongoDB has no nested transactions**, `circulation.ts` now exports
  `issueLoanInSession`: `fulfilReservation` opens one transaction and calls the same code the desk
  calls, every rule of business rule 1 intact. Calling the public `issueLoan` from inside a
  transaction would either fail or commit the loan *outside* it, leaving the member with a book
  and a hold still holding a copy out of the catalog.
  - The defensive check afterwards is not belt-and-braces: if the hold did not close, the
    transaction aborts and **nothing** is issued, rather than handing out a book that was never
    actually being held for anybody.
- **An automatic expiry writes no audit row, deliberately.** `logAudit` needs an actor and there
  is none — the clock did it. Inventing a "system" user is exactly what Unit 13 got wrong on
  `createFineIfLate`. The `ready → expired` state change plus the member's `reservation_expired`
  notification is the record. `reservation.create` / `.cancel` / `.fulfil` **are** audited.
- **The FIFO algorithm exists once.** `activeQueuePositions` (keyed by reservation id) replaced
  the private copy in `members.ts` and serves the member record, the member's own page and the
  staff register. The old helper returned only the positions of *one* member, so each new caller
  would have needed its own — three copies of "where is this member in the queue" is three
  answers.
- **A `ready` hold is counted in the FIFO order but never numbered.** Three copies returned means
  three holds at the head, so the first person still waiting is #4 — which is true, because three
  people will be served before them. But a member whose copy is already set aside is not waiting
  for a place, and giving them `#1` would label two members #1 on the same book. `queuePosition`
  and `QueueEntry.position` therefore agree: non-null only while `waiting`.
  - **This was found by a failing assertion, not by reasoning.** The first implementation stored a
    number for every active hold and returned the index one higher, so the very first member to
    reserve a book was told "You are #2 in line". The browser check caught it; the type documents
    had not, because both said "a place in the queue" without saying whether a ready hold has one.
- **`hoursUntilExpiry` is server-derived and rounded up.** The alternative is "0 hours left" while a
  copy is still on the shelf with the member's name on it. It is exported and reused by
  `members.ts` so the record tab and the member's own page cannot disagree about how long a hold
  has left — two copies of a rounding rule is how a count-down disagrees with itself.
- **`GET /api/reservations` `status` accepts a comma-separated list.** A single-value enum is not
  enough for the staff History tab, which is three states and must be *one* paginated request: a
  tab assembled from three calls is a lie the moment one of them fails. An unknown token is a 422
  naming the valid values rather than an empty table.
- **`GET /api/reservations/mine` returns the three groups already built**, with `pastTotal` beside
  the capped `past`. Grouping in the client would drop rows the moment a member had more than one
  page of history, which is what "Past" always is. It takes no member id and no filters at all —
  the schema has neither, so editing the URL cannot reach somebody else's queue.
- **Five routes**, all `handler()` → guard → zod → one service call. `/mine` resolves the member
  from the session; `DELETE` authorises **in the service** (owner or staff, 403 otherwise)
  because both are allowed and the reservation's own member is what tells them apart;
  `POST /reservations` uses `requireActiveMember()` and `POST /reservations/:id/fulfil` uses
  `requireStaff()`.
- **`lib/validators/reservation.ts`** — shape only. No `.max(3)` on reservations: `maxReservationsPerMember`
  and `reservationHoldHours` are read from Settings at request time (invariant 7), and a zod cap
  would freeze the policy into the transport layer.
- **`circulation.ts` reuses the queue primitives with a session now.** `getReadyHoldCounts` was
  being read from inside `issueLoan`'s transaction *without* it, so the hold count came from
  outside the snapshot the rest of the transaction was reasoning about — a hold promoted by a
  concurrent return could be invisible to the issue that was supposed to respect it.
- **`circulation.ts` no longer imports `books.ts`.** It imported it only for
  `getReadyHoldCounts`, which now lives in the queue layer; `books.ts` re-exports it for
  `withAvailability` and imports `getQueueInfo` back, so the graph stays acyclic.
- **UI, member `/reservations`** — cards grouped **Ready / Waiting / Past**, not tabs. A tab that
  says "Ready" with no number is a question the member has to click to answer, and the reason they
  opened the page is almost always "is my book ready yet". A `ready` card is the only state with
  a success tint, a countdown and a sentence about where to go; cancel opens a dialog that says
  the copy goes to the next reader, not "are you sure?".
- **UI, staff `/staff/reservations`** — tabs Ready / Waiting / History, desktop `<table>` and
  stacked cards from **one array** with shared status-line and timeline helpers. **Only a `ready`
  hold has a row menu**, because a `waiting` hold has no copy to issue and a closed one is
  terminal; offering a control guaranteed to fail is worse than showing none.
- **UI, book detail** — Reserve is live. Four states, each saying what the reader must do next: a
  copy is on the shelf → *Borrow at the desk*; nothing held → *Reserve* plus the place they would
  get; waiting → their live place and a working *Cancel*; ready → the success panel and the
  server's countdown. `userState` gained `reservationId`, `reservationPosition` and
  `readyHoldHours` so the page can cancel and count down **without a second request and without
  a second implementation** of the FIFO or rounding rules.
  - **`reservationId` is not optional polish.** The first version cancelled by `book._id`, which is
    a 404 or — worse — cancels whatever hold that id happened to match. A control labelled "Cancel"
    must actually cancel, not navigate to another page and ask there.
- **UI, "View queue" sheet** on the books table row menu. It asks for `status=waiting,ready`
  rather than every reservation the book ever had, because the question behind the menu is "who is
  waiting for this?" and a year of cancelled holds would bury the answer. Present on every row,
  including one with an empty queue — the sheet says "nobody is queuing" instead of leaving the
  question unanswered.
- **`lib/api-client.ts` gained `reservationsApi`** — `list`, `mine`, `reserve`, `cancel`, `fulfil`.
- **Verified against the live local MongoDB: 74/74 API checks and 43/43 browser checks, 0 page
  errors, 0 console errors, 0 unexpected failed requests**, at 390 / 768 / 1280 px in light and
  dark. Every item on the spec's checklist is ticked below. `tsc`, `eslint` and `next build` clean;
  all five routes and both pages present in the build output.
  - **The queue, proved end to end**: two members queue for a two-copy book, one copy is returned,
    and **exactly one** hold is promoted — the second member is still waiting. Issuing that copy to
    a third member is refused with *"Every copy of … is on hold for another member"*, while the
    member it is held for can still collect it, and collecting at the desk closes the hold as
    `fulfilled` with `fulfilledLoanId` pointing at the loan.
  - **Expiry**: a hold forced past its `expiresAt` moves to Past as `expired` on the next
    `/mine`, and the member behind it is promoted with a **fresh 48-hour** window. The sweep moves
    no copies — it only re-points holds.
  - **Renewal is blocked** while another member waits, with the count in the sentence.
  - **`effectiveAvailable` follows holds**: a two-copy book with one copy on loan and the other
    held reads `0`, and drops back to `1` the moment the hold is cancelled.
- **Deliberately not done:**
  - **`reservation.expire` audit rows.** See above — there is no actor.
  - **The maintenance job.** `runMaintenance()` is Unit 16. Expiry runs lazily inside `reserve`
    and `/mine` instead, which is enough for correctness: a hold that is not closed is a copy that
    stays invisible to the catalog.
  - **Notifications are still a no-op.** All four reservation types are declared and the calls are
    in place; `notify` becomes real in Unit 16.

### Unit 13 — Fines ✅ · `feat/13-fines`
- **Fine lifecycle end to end**: raised on a late return, listed on both sides, collected or
  waived at the desk, and settled back into the member's borrowing limit.
- **`createFineIfLate` moved out of the Unit 11 stub** into `lib/services/fines.ts` and now
  runs **inside the return transaction**, so `loan.fineAmount`, the `Fine` document, the
  `fine.create` audit row and the member's `fine_created` notification either all commit or
  none do. Circulation still owns the day count and the fine owns the money, which is why the
  amount and the "6 days late" badge cannot disagree.
- **The rate is read from the settings singleton at request time**, never frozen into a `zod`
  cap (invariant 7). `ratePerDay` is snapshotted onto the fine, so an admin changing
  `finePerDay` next month does not retroactively alter what this fine was charged at.
  `amount` is rounded to cents *before* the `maxFinePerLoan` comparison is persisted, so the
  stored number matches the number the UI prints. A 400-day-overdue book caps at
  `maxFinePerLoan`, it is not 2000 dollars.
- **Four routes**: `GET /api/fines` (staff, filter by `q` / `status` / `memberId` / `bookId` /
  `from` / `to`), `GET /api/fines/mine` (no member id — it comes from the session,
  invariant 3), `POST /api/fines/:id/collect`, `POST /api/fines/:id/waive`.
- **`collectFine` requires the amount to match exactly — neither less nor more.** `Fine` has
  no `amountPaid` field, so a part payment has nowhere to record a balance (refused), and
  overpaying has nowhere to record change (also refused). The second case was found while
  building this unit: the check originally rejected only amounts *below* the fine, so
  `$100` against a `$15` fine would have set `status: "paid"` while `fine.amount` stayed
  `15.00`, and the `fine.collect` audit row would have claimed 100.00 was taken. Both now
  fail loudly with the exact figure in the field error.
- **`waiveFine` requires a reason** (`min(3)`, `max(500)`), because forgiving someone's debt
  is the one fine action that leaves no trace of who decided it or why. Both actions are
  **terminal**: a second collect or waive on a settled fine is refused, not silently ignored.
- **The fine block is a real gate, not a warning.** `getMemberUnpaidFineTotal` is compared
  against `fineBlockThreshold` in `issueLoan`, so a member over the threshold cannot borrow
  until they settle. This is why that function exists separately from `listMyFines`:
  circulation must not have to build a page of fines to ask "may this person borrow?".
- **`/fines`** (member) — an outstanding-balance summary above a Unpaid / Paid / Waived tab
  set, so the number a member actually came for is not below the fold.
- **`/staff/fines`** — three KPI cards, then a filterable table. Two layouts from one array,
  exactly as `MembersTable` and `LoansTable` do.
- **`StatCard` gained an optional `format` prop.** It rendered `value.toLocaleString()`, which
  is right for a count and wrong for an amount of money: the Unpaid total displayed as `20`
  where the row beneath it displayed `$20.00`. Three identical-looking figures with no
  currency mark is the kind of thing that is read as twenty books. `format` is applied to
  the **animated** value, so the symbol is present on every frame of the count-up instead of
  popping in at the end. Unit 17's dashboards need this too.
- **`FineActionDialog` reuses `collectFineSchema` / `waiveFineSchema`** rather than restating
  them. The browser is precisely where a duplicated rule would have drifted from the server's
  copy: the form would call a value valid and the API would reject it. The form types are
  `z.input<…>`, not the output type, because `amount` is `z.coerce`d and arrives as a string.
- **`lib/services/refs.ts`** — the book/member reference lookups extracted so `fines.ts` and
  `circulation.ts` can both use them. `fines.ts` imports from `circulation.ts`, so sharing
  them directly would have been a circular import.
- Verified: `tsc`, `eslint` and `next build` clean; all four fine routes and both pages
  present in the build output. **42/42 API and business-rule checks passed** against the live
  dev database: 3 days late at $5/day → $15, a very overdue loan caps at 250, on-time returns
  create no fine, `loan.fineAmount` matches the Fine document, part payment is refused,
  collect and waive are terminal, waive demands a reason, and a member over the threshold is
  blocked. **Staff page browser-verified** at 1280 / 768 / 390 px with no horizontal
  overflow, both dialogs opening correctly and **zero console or page errors**.
- **The audit actor was wrong on first write.** `createFineIfLate` was passing the **loan's**
  id with a fabricated `"system" as never` role, which would have written every
  `fine.create` row attributed to a loan instead of to the staff member who took the book
  back — an audit trail that points at the wrong entity, on the one collection whose whole
  purpose is to be defensible. There is no `system` role; the real `actor` is now passed in
  from `returnLoan`. `tsc` passed throughout because `as never` defeats the type check, which
  is exactly the case a cast exists to hide.
- **Not done:** a fine created outside a loan-return path (a manual charge) — the spec has no
  such action, so there is no way to raise one from the UI, and inventing a route for it
  would be a way to fine someone by accident.

### Unit 12 — Circulation UI ✅ · `feat/12-circulation-ui`
- **`/staff/circulation`** — the desk. Two search cards side by side (member, book), an
  issue ticket with a policy checklist, then the filterable loan table. Above the fold
  because issuing and returning are the two things that happen here thousands of times.
- **`/my-loans`** — the member's own loans. Current (cards + countdown ring) and History
  (compact rows).
- **The member record gained its "Issue a book" action** (F6), a real `<Link>` to
  `/staff/circulation?memberId=…` so it is openable in a new tab and has an href to copy.
- `GET /api/settings/public` added — a **display-safe policy subset**, unauthenticated. The
  countdown ring needs `loanPeriodDays` and a member must not need a staff session to see
  their own loan period, but this must not be a settings dump: `contactEmail`,
  `fineBlockThreshold`, `maxFinePerLoan` and `lastMaintenanceAt` are deliberately excluded,
  and the type is a hand-written subset rather than `SettingDoc` so a field added later
  is not exposed by accident.
- **`useRemoteCombobox`** (`src/hooks/`) — the debounce, abort, stale-result and keyboard
  logic the two comboboxes share, extracted rather than written twice. It is the subtle
  part of both:
  - **results are stored keyed by the term that produced them** and the visible list is
    *derived* by comparing that key with the current term. That removes every synchronous
    `setState` from the effect body (`react-hooks/set-state-in-effect`, and it is right to:
    the effect runs after paint, so the UI would briefly show results for a term the user
    has already moved past) while guaranteeing a stale list can never be shown.
  - the highlight is **derived-clamped**, not corrected in an effect, so an out-of-range
    highlight can never even paint.
  - **one `choose` path** for click and Enter, so clearing the list cannot happen on one
    interaction and not the other.
  - `onChoose` is read through a ref **written in an effect**, never during render —
    `react-hooks/refs` caught the render-phase version.
- `use-loan-filters.ts` carries Unit 08's **focus-owns-the-value** rule and the per-kind
  history rule rather than rediscovering them, and also syncs `memberId` / `bookId` so a
  deep link survives a reload.
- **Two comboboxes, not two `Select`s.** A member is searched across potentially thousands
  of rows, so the control must filter remotely. Rows are chosen with `onMouseDown` +
  `preventDefault` so the click lands *before* the input's blur unmounts the list;
  `onClick` loses that race.
- `BookSearchCombobox` asks for `status: "active"`, so **archived books are never offered**
  rather than being selectable and then refused. A book with no free copy stays selectable
  and badged "None left", because the librarian may be about to return it and the ticket
  explains the refusal in a sentence they can read to the member.
- **`IssueTicket`'s checklist is a preview, never the gate.** Every check can be stale —
  another librarian can take the last copy between the search and the click — so the server
  remains the authority and its sentence is shown verbatim in a toast. The **unpaid-fine
  check is `unknown`, not a green tick**: the member lookup returns no fine total, and a
  checkmark asserting something nothing has verified is the one check a member would be
  most upset to get wrong. Disabled buttons carry a reason, because a dead button with no
  explanation is the most common desk complaint there is.
- **`LoansTable` renders both layouts from one array** — a real `<table>` from `md` up and
  stacked cards below — the same decision as `MembersTable` and the books table.
- **`MyLoanCard`'s ring is the centrepiece** because days remaining is the only thing a
  member is asking. The number is **real text**, not SVG content, so it scales, is
  selectable and is announced once via `role="status"`; the arc is decoration that follows
  the number. Renewal is **optimistic** and rolls back on failure, and the reason is a
  `title` *and* an `sr-only` line, because a `title` alone is unreachable by touch.
- Renew is the **only non-staff mutation** and the ownership check lives in the service, so
  the button's refusal copy is a preview and the server's message wins.
- The **overdue ribbon is a left edge, not a diagonal fold** — a diagonal clips the rounded
  corner and reads as damage rather than as a state.
- `MemberBookRef` is `LoanBookRef`, so `slug` reaches the member record and the member's
  tabs now link straight to `/catalog/[slug]` instead of the search-query workaround that
  existed only because the slug was missing.
- Verified: `tsc`, `eslint` and `next build` clean; `/staff/circulation`, `/my-loans` and
  `/api/settings/public` all present. **Not** browser-verified — the mutations still cannot
  run against the standalone dev database (see below).

### Unit 11 — Circulation Services & API ✅ · `feat/11-circulation`
- `lib/services/circulation.ts` — `issueLoan`, `returnLoan`, `renewLoan`, `listLoans`,
  `listMyLoans`, plus the shared `deriveLoanState`, `bookRefs` and `bookRefOr`.
- **All three mutations run inside `withTransaction`** (invariant 5). Issuing touches the
  loan collection *and* the book's copy count; without a transaction a failure halfway
  leaves a loan with no copy removed, or — far worse and invisible until a member asks why
  they cannot borrow — a copy removed with no loan.
- **The copy is taken with one conditional update** (`{ availableCopies: { $gt: 0 } }` plus
  `$inc`), which is what makes two simultaneous issues for the last copy safe: the loser's
  condition no longer matches and it gets a clear conflict rather than driving the count
  negative. It deliberately bypasses the document validator, because the filter's guard is
  the stronger check — Mongo refuses the whole update when the condition fails.
- **The copy is restored with an `$expr` guard** comparing `availableCopies` to
  `totalCopies` *inside the update filter*. A `$lt` cannot compare two fields of one
  document, and checking in application code would reopen the race invariant 5 exists to
  close. If the guard fails the transaction aborts, so `availableCopies` can never exceed
  `totalCopies`.
- **Every policy number comes from `getSettings()`** at request time (invariant 7). There
  is deliberately no `maxActiveLoans` or `loanPeriodDays` constant in the file, and
  `lib/validators/loan.ts` validates *shape only* — a `zod` `.max(5)` would freeze the
  policy into the validator and silently disagree with an admin who changes it in Settings.
- **Every refusal is a sentence a member can act on**, and the policy limit is quoted in
  the message: *"shumail already has 5 books on loan. The limit is 5."* Policy refusals
  carry a **field** error where one applies (`memberId`, `bookId`) so a form can put the
  message beside the input instead of in a banner.
- **Availability subtracts holds.** `availableCopies - readyHoldsForOtherMembers`, reusing
  the `getReadyHoldCounts` already exported from `services/books.ts`. The member's *own*
  ready hold is excluded, because issuing is how they collect it — and that hold is
  consumed through `fulfilReadyReservationIfAny` rather than left dangling.
- `lib/services/hooks.ts` — the stub contract the spec asked for, naming each seam and its
  owning unit: `createFineIfLate` (13), `promoteReservationQueue` (14),
  `fulfilReadyReservationIfAny` (14). All take the open `session`, because a hook that
  opened its own connection would write **outside** the transaction.
- **`countOtherReservations` is implemented for real, not stubbed.** The spec calls it a
  stub, but a stub returning `0` would let a renewal through on exactly the book other
  members are queuing for, silently breaking business rule 3. A stub is only safe when its
  "no data" answer is the permissive one; here the permissive answer is the wrong one, and
  the `Reservation` collection plus its indexes have existed since Unit 02. What Unit 14
  owns is the *queue* — promotion, expiry, cancellation — not this existence check. The
  member's own hold is excluded, or a member who reserved and then collected could never
  renew.
- `deriveLoanState` is **the single definition** of `on_time | due_soon | overdue |
  returned`. `services/members.ts` now imports it, and `deriveLoanState` returns
  `daysLeft` as well as `daysOverdue`.
  - **The rule changed while moving, deliberately.** It now counts **calendar** days
    (date-fns `differenceInCalendarDays`, invariant 12) instead of whole 24-hour blocks. A
    book due at 23:00 yesterday and returned at 01:00 today is **one** day late; the old
    24h arithmetic charged nothing for a book that crossed midnight, and the fine — which
    is `daysOverdue × ratePerDay` — would have followed that wrong number. The `overdue` and
    `due_soon` **list filters** use `startOfDay`/`endOfDay` to match, so a loan can never be
    listed under "overdue" while its badge says 0 days.
- `MemberBookRef` is now `LoanBookRef` and `MemberLoan` is `Omit<LoanSummary, "member">`,
  so one row shape serves the desk and the member record and cannot drift (the Unit 08
  payload lesson). Carrying `slug` also let the member record link straight to
  `/catalog/[slug]` instead of the search-query workaround it previously needed.
- Routes: `GET /api/loans`, `GET /api/loans/mine`, `POST /api/loans/issue`,
  `POST /api/loans/:id/return`, `POST /api/loans/:id/renew`. `/mine` takes **no member id**
  — it comes from the session, so the URL cannot be edited to read someone else's loans.
  Renew is the one non-staff mutation, because renewing your own book is a member
  capability; the ownership check lives in the service, so no caller can skip it.
- `loansApi` added to `lib/api-client.ts`, with the fetcher taking **no positional
  parameters** — the SWR rule that has bitten this codebase twice.
- Verified: `tsc`, `eslint` and `next build` clean, all 5 routes present.

### Unit 11 — BLOCKED at runtime locally: the dev database is not a replica set
**The circulation engine cannot run against the current local `mongod`.** Probed directly:

```
setName:  (none — standalone)
transaction commit: FAILS -> IllegalOperation: Transaction numbers are only allowed on a
                                   replica set member or mongos
```

`architecture.md` states Atlas provides a replica set on every tier and that issue/return
run in a transaction (invariant 5), so **the code is correct for the documented production
topology**. This is a dev-environment gap, not a code defect, and it was flagged in the
tracker before this unit started.

- Every `issueLoan` / `returnLoan` / `renewLoan` will currently return a generic 500
  locally. `handler()` maps the driver error to `INTERNAL`.
- **Not worked around.** A fallback that runs these writes without a transaction would
  quietly break the exact invariant the unit exists to enforce, and would produce a rare
  "why can I not borrow this" bug that is far more expensive than the current loud 500.
- **Fix is environmental**: restart the local `mongod` with `--replSet rs0` and run
  `rs.initiate()`, or point `MONGODB_URI` at Atlas. Awaiting the developer's decision — it
  means restarting a database service on their machine.
- The read routes (`GET /api/loans`, `GET /api/loans/mine`) are unaffected and work today.

### Unit 10 — Members & Team Management ✅ · `feat/10-members-team`
- `lib/validators/members.ts` — `listMembersQuerySchema`, `lookupQuerySchema`,
  `suspendMemberSchema`, `createLibrarianSchema`, `updateTeamMemberSchema`, `memberIdSchema`.
  `createLibrarianSchema` **reuses `emailSchema` / `passwordSchema`** from
  `lib/validators/auth.ts` so a staff account and a member registration cannot drift on what
  counts as valid. `updateTeamMemberSchema` is a plain object + `.refine()` rather than
  `.extend()` on a refined schema — the Unit 09 Zod 4 trap.
- `lib/services/members.ts` — `listMembers` (escaped regex across name/email/membership ID,
  one `$facet`-free count + page so `meta.total` is honest), `getMemberDetail`,
  `lookupMembers` (capped at 8, **active members sort first**), `suspendMember`,
  `activateMember` (**idempotent** — reinstating an active member succeeds without a second
  audit row or a duplicate notification), `resetPassword`.
  - Suspension always carries a **reason**, stored, audited and notified. Activate **clears**
    the reason, because leaving it would keep showing a stale explanation on the member's
    banner after the problem was fixed.
  - `resetPassword` is the only place a plaintext exists: it is hashed and returned once,
    never stored, never logged, never placed in an audit `before`/`after`.
- `lib/services/team.ts` — `listTeam`, `createLibrarian`, `updateTeamMember`.
  - **`membershipId` is omitted entirely for staff**, not set to `null`. A sparse unique index
    treats an absent field as absent but a stored `null` as a value, so a `null` would limit
    the library to one staff account. This is the first code path that creates a staff user,
    and it is the first exercise of that rule.
  - **Role is not editable**, and an admin cannot change their own status or disable the
    **last active admin** — both would leave nobody able to restore staff accounts.
  - Duplicate email returns a **field** error, not a 500.
- Routes: `GET/POST /api/members`, `GET /api/members/:id`, `GET /api/members/lookup`,
  `POST /api/members/:id/{suspend,activate,reset-password}`, `GET/POST /api/team`,
  `PATCH /api/team/:id`. Matches the contract already in `api-contract.md` §Members & Team.
- **`src/lib/password-generator.ts`** — new client-safe module. The temporary password is
  generated **in the browser** so an admin reads it before committing (a mistyped email is
  caught before the account exists) and again server-side on reset, from **one** implementation
  so the alphabet and the letter/digit guarantee cannot drift. Uses `crypto.getRandomValues`
  with rejection sampling (no modulo bias) because this value is a credential; excludes
  `0 O 1 l I` because these are read off a screen once and typed by hand.
- `lib/auth/password.ts` now holds only hashing; it re-exports the generator.
- **UI** — `/staff/members`: `MembersManager` (URL-synced search + Active/Suspended tabs,
  `aria-live` count, server-driven pagination, error and empty states), `MembersTable` (one
  component renders the desktop `<table>` and the stacked mobile cards from the same data),
  `MemberRowActionMenu` (destructive action swaps with status instead of sitting disabled),
  `SuspendDialog` (reason is required and is the point of the dialog), `ResetPasswordDialog`
  (confirm → reveal-once with copy, and it says so).
  `/staff/members/[id]`: `MemberHeader` (identity, status, the suspension reason, four KPI
  `StatCard`s) + `MemberTabs` (Overview, Loans, Fines and Reservations all render **real
  rows** from the record — see the fix below; the first version shipped them as
  "arrives with the circulation work" placeholders, which was wrong).
  `/staff/team`: `TeamManager` + `AddStaffDialog` (**role-aware**: librarian or administrator,
  chosen in the dialog; password generated up front so a mistyped email is caught before the
  account exists) + `RenameTeamMemberDialog` + `RolePicker`, all with one scroll region and a
  pinned footer per the Unit 07 rule.
- `src/hooks/use-member-filters.ts` follows Unit 08's **focus-owns-the-value** rule and the
  per-kind history rule rather than rediscovering them.
- **The detail page needs no serialisation step**: `getMemberDetail` reads `.lean()` and maps
  through `toMember`, so it already returns a plain object — unlike Unit 08's `listCategories`.
- **Verified against the live local MongoDB** after the two fixes below (login as admin,
  `/api/members`, `/api/members/:id`): counts and rows agree
  (`activeLoans=1, totalBorrowed=1, unpaidFines=0, activeReservations=1`), the loan row
  carries its real book title, `view=on_time` and ISO dates, and the waiting hold reports
  `queuePosition=1`. The reset-password reveal is fixed but was **not** confirmed in a
  browser — see the note on that fix.

### Unit 01 — Bootstrap & Design System ✅ · `feat/01-bootstrap-design-system`
- Restructured to `src/` with the `@/*` → `./src/*` alias, matching `architecture.md`.
- **Parchment & Ink tokens** in `src/app/globals.css`: full light + dark palettes, radii, `shadow-soft` /
  `shadow-lift`, type scale, category accents, and `-soft` + `-ink` status pairs, mapped to Tailwind through
  one `@theme inline` block.
- **Fonts** via `next/font` — Fraunces (display), Inter (body), JetBrains Mono (codes).
- **Theme**: `next-themes` (class strategy, `system` default) + animated `ThemeToggle`.
- **Base UI kit**: 23 shadcn/ui primitives restyled onto the tokens, plus `Field` and root `not-found.tsx`.
- **`components/common`**: `PageHeader`, `EmptyState`, `StatCard` (+ skeleton, count-up), `StatusBadge`,
  `ConfirmDialog`, `BookCover` (2:3 + generated fallback), `Logo` (+`InitialAvatar`), `Spinner`, `FormAlert`.
- **`src/lib/motion.ts`** (`motionTokens`, `transitions`, `springs`, `fadeUp`/`stagger`/`scaleIn`/`slideIn`
  + `*Reduced`) and `src/hooks/use-motion-variants.ts` built on `useSyncExternalStore`.
- **`lib/utils.ts`**, **`lib/constants.ts`** (all domain enums, routes, nav config), **`lib/cloudinary.ts`**.
- **Style guide** at `/styleguide` (dev-only, hard-404 in production).
- Verified: 0 console errors · CLS 0.0000 · both palettes · 360/768/1280 · contrast ≥ 4.5:1 · prod 404.

### Unit 02 — Database & Models ✅ · `feat/02-database-models`
- `lib/db.ts`: cached `connectDB()` on `globalThis`, `withTransaction()` via `session.withTransaction`,
  clear error when `MONGODB_URI` is missing.
- **12 Mongoose models** with every index from `data-model.md`, enums reused from `lib/constants`:
  - `Book` weighted text index (title 5, isbn 4, authors 3, tags 2) + pre-validate guard on
    `availableCopies <= totalCopies`.
  - `Loan` partial unique index on `{book, member}` where `status='active'` — the "one active loan of the
    same book per member" rule is now a database guarantee.
  - `Reservation` FIFO index + partial unique index across `waiting`/`ready`.
  - `Notification` unique sparse `dedupeKey` for maintenance idempotency.
  - `AuditLog` createdAt-only, never updated or deleted. `User.passwordHash` is `select:false`.
- Services: `getSettings()` (upserts singleton, 30s cache), `logAudit()` (real, session-aware, never
  throws), `notify()` (documented stub → Unit 16), `nextMembershipId()` (atomic `$inc` per year).
- `lib/api.ts`: `AppError`, `ok`/`fail`, `parseBody`/`parseQuery`/`parseParams`, `paginate`, `buildMeta`,
  `handler()` (connectDB → callback → error funnel).
- `GET /api/health`.

### Unit 03 — Auth API & Route Protection ✅
- Validators: `registerSchema`, `loginSchema`, `changePasswordSchema` (shared with the Unit 04 forms).
- `lib/auth/*`: `jwt.ts` (jose HS256, 7d), `cookies.ts` (httpOnly/Lax/Secure, dependency-free serialiser),
  `session.ts` (`getSession`, `requireSession` re-reading the user from the DB, `requireRole`, `requireStaff`,
  `requireAdmin`, `requireActiveMember`, `getCurrentUser`, `toPublicUser`), `password.ts` (bcrypt cost 10),
  `rate-limit.ts` (sliding window, 5 / 10 min per IP+email, reset after success).
- Routes: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`,
  `PATCH /auth/password`.
- `src/middleware.ts`: anonymous → `/login?next=…`, member → `/dashboard` on `/staff/*`,
  librarian → `/staff` on admin-only pages, signed-in → role home from `/login` / `/register`.

### Unit 04 — Auth UI ✅
- `AuthLayout`: two panels ≥1024px (form on `background`, decorative panel on `primary` with the Fraunces
  quote and CSS book spines); single column with a compact logo below that.
- `BookSpines`: 10 CSS-shape spines in category accent colours, slow offset sine drift, transform only,
  fully disabled under `prefers-reduced-motion`.
- `PasswordInput` (Eye/EyeOff toggle, `aria-pressed` + dynamic label), `PasswordStrength` (4 segments,
  Weak/Fair/Good/Strong, polite live region), `TextField` (label + icon + 44px control + message),
  `FormAlert` (role=alert, shake, tone per error class).
- `/login`: email, password, "keep me signed in", inline zod validation, generic error banner, rate-limit
  tone, `next` param validated as a same-origin path only.
- `/register`: name, email, phone, department select (10 options + "Other" free text), password with
  strength meter, confirm password. Server field errors (e.g. email taken) map onto the matching field.
- `lib/api-client.ts`: typed fetch wrapper with the standard envelope and `ApiRequestError`.
- **Verified in headless Chrome**: 57/58 checks passed · **0 console errors, 0 page errors, 0 failed
  requests** · 360/768/1280 × light/dark · CLS 0.0000 · 44px inputs · pointer targets ≥ 40px (checkbox
  ≥ 24px) · strength meter escalates · mismatch detected · 11/11 controls keyboard-reachable with visible
  focus rings · reduced motion disables the spine drift.
  - The single non-pass was a wrong assertion in the harness (it expected 10+ of 12 tab stops to be
    controls; the register form has exactly 11 controls, so the browser chrome takes the rest).

### Unit 05 — App Shell & Navigation ✅
- `AppShell` (member + staff variants): 264px sidebar collapsing to a 72px rail, sticky topbar, mobile
  drawer under 1024px, five-item bottom tab bar under 768px for the member area only.
- `Sidebar` with Main / Manage / Admin sections derived **by role**, so a librarian never sees the Admin
  group. `SidebarItem` active state uses a framer-motion `layoutId` pill; `/staff` and `/dashboard` match
  exactly so the dashboard does not stay lit on sub-pages.
- `Topbar` (hamburger, breadcrumbs, search, bell, theme, account menu), `Breadcrumbs` (labels resolved
  from the nav config so they cannot drift), `MobileNav` (Radix Sheet), `BottomTabBar` (`layoutId` active
  indicator), `UserMenu` (identity, role badge, membership ID, profile, theme, sign out),
  `NotificationBell` (static until Unit 16), `SuspendedBanner` (non-dismissible, `role="status"`).
- Layouts resolve the session user **on the server** and pass it down, so there is no client fetch and no
  auth flash. `staff/layout.tsx` re-checks the role server-side (defence in depth) and admin-only pages
  re-check `requireAdmin()` in the page itself.
- 18 placeholder routes (7 member + 11 staff), each with `PageHeader` + `EmptyState` + `loading.tsx`
  skeleton, plus scoped `not-found.tsx` and a root `error.tsx`.
- **Migrated `middleware.ts` → `proxy.ts`**: Next.js 16 renamed the file convention and the old name logs
  a deprecation warning. Build output now reports `ƒ Proxy (Middleware)` with no warning.
- **Verified in headless Chrome**: 26/26 checks · **0 console errors, 0 page errors, 0 failed requests** ·
  member/librarian/admin each see exactly their own nav (no admin leakage to librarians) · collapse
  264 → 72px and persists across reload · drawer opens, traps focus and closes on Escape · bottom tab bar
  has 5 items with ≥44px targets and none falsely active off-route · staff get no tab bar · suspended
  banner renders · anonymous requests to all six protected route families redirect to `/login` ·
  user menu shows identity and membership ID.

### Unit 08 — Books (Catalog Management) ✅
- `lib/validators/book.ts` — `createBookSchema` / `updateBookSchema` / param and query schemas,
  plus real **ISBN-10/13 mod-11 checksum** validation (`normalizeIsbn`, `isValidIsbn`).
  `updateBookSchema` is composed from the same field schemas rather than
  `createBookSchema.partial()`, so Zod 4's "`.partial()` keeps an inner `.default()`" trap
  cannot clobber `language` on a partial update. Empty input on an optional numeric field
  becomes `undefined`, not a NaN error. `BOOK_SORTS` / `BOOK_STATUS_FILTERS` /
  `staffBooksQuerySchema` all live here; sorts are re-exported from `lib/constants` rather
  than redeclared, because two arrays of the same names is how an option ends up accepted
  by the API and missing from the toolbar.
- `lib/services/books.ts` — `listBooks`, `getBook`, `createBook`, `updateBook`, `setArchived`,
  `deleteBook`, `bulkArchive`. Copy arithmetic is by **delta**
  (`availableCopies += newTotal − oldTotal`), so removing copies can never strand the count
  below zero and the rejection names how many are out on loan. Delete is refused with
  history (and separately with active holds) and only destroys the Cloudinary cover **after**
  the row is gone, so a failed delete cannot orphan the image. Slugs de-duplicate.
  All six actions audited; updates carry `before`/`after`.
- Routes: `GET/POST /api/books`, `GET/PATCH/DELETE /api/books/:id`,
  `POST /api/books/:id/archive`, `POST /api/books/bulk-archive`.
  Every handler is `handler()` → `requireStaff()` → zod → one service call. The `status`
  downgrade to `active` for non-staff lives in the **handler**, so it holds regardless of
  which route reaches the service.
- `lib/api-client.ts` gained `requestWithMeta`, because `request` discarded the envelope's
  `meta` and pagination cannot be derived from `items.length` once a page is full.
- **Wire shapes are declared once, in `types/index.ts`.** The service and the client had each
  declared their own copy of the book payload and they drifted (service `isbn?: string | null`,
  client `isbn: string | null`), which made passing a service result to a client component a
  type error with no obvious cause.
- **`toCategorySummary` / `toApi` are the only ways out of a service.** They existed and were
  not used: the API route relied on `JSON.stringify` coercing ObjectIds to match its declared
  type, and a Server Component passed lean Mongoose documents straight to a Client Component.
  See Architecture §Server → Client prop boundary.
- UI — `/staff/books` (toolbar: debounced search, category select, Active/Archived/All tabs,
  sort menu, filter count + reset; DataTable with cover thumb, title+authors, mono ISBN,
  category chip, availability bar, shelf, status, row menu; under `md` the same data renders
  as stacked cards **with their own select-all**), `/staff/books/new` and
  `/staff/books/[id]/edit` (two-column: cover uploader + live `BookCover` preview on the left,
  Basic Info / Publication / Inventory on the right, **sticky action footer**).
- `IsbnField` (live checksum tick, `aria-describedby` instead of an icon announcement),
  `AuthorsInput` / `TagInput` (chips; authors commit on blur so a surname is never lost,
  tags refuse duplicates with a `role="status"` message rather than dropping them silently),
  `CopiesBar` (`role="progressbar"`, AA-safe `-ink` tones), `BookRowActionMenu`,
  `BookCategoryChip`, `BookStatusPill`, `BookTableSkeleton`.
- `src/hooks/use-book-filters.ts` — the URL is the source of truth for `q`, `category`,
  `status`, `sort`, `page`. **History is per-kind**: discrete choices `push` (so Back undoes
  them, per F5) while the debounced search box `replace`s (a keystroke must not create a
  history entry). See the bugs section for why reconciling the debounce against the URL was
  the hard part.
- `src/hooks/use-unsaved-changes-guard.ts` — `beforeunload` for browser-level navigation, the
  **Navigation API** for the hardware Back button (no click event to intercept), and a
  capture-phase same-origin link interceptor as the fallback. It reports the blocked
  destination and never navigates itself, so the host owns both the confirmation and a
  client-side transition.
- **Verified end to end against a real local MongoDB** — 73 API checks and 129 browser checks,
  0 page errors, 0 unexpected console errors, 0 unexpected failed requests:
  create → appears in the table with the right copies; raising/lowering `totalCopies`
  recalculates `availableCopies` and lowering below the on-loan count is refused with the
  number named; bad checksum / wrong length / duplicate ISBN each return a **field** error;
  archive/restore both ways; delete refused for loan history and for active holds, and
  allowed for a never-loaned book; search matches title, author, ISBN and tag; category filter,
  six sorts and pagination all work and are shareable by URL; bulk archive is idempotent;
  anonymous and member callers get 401/403 on all five mutation routes; the unsaved-changes
  guard blocks a sidebar link, preserves the draft on "Keep editing", and really navigates on
  "Discard"; Save is inside the viewport at 1920×1080, 1440×900, 1366×768, 1280×720 and
  1024×640; 360/768/1280 × light/dark, no overflow, no mojibake, CLS ≈ 0; all six audit actions
  present in the database with `before`/`after` on updates.

## Next Up
1. **17** Dashboards →
   **18** Reports & Audit → **19** Settings →
   **20** Landing & Polish → **21** Seed, QA, Docs & Deploy.
   - **Unit 16 is committed but not finished.** Fix `POST /api/maintenance/run` first if the
     job matters: nothing else in the app depends on it, so it can safely sit until after
     Unit 17. `notify()` itself — the part every other feature uses — works.
   - **Unit 17 can use what Unit 16 already built**: the staff layout fires
     `runMaintenanceIfDue()`, so a dashboard's "last run" figure has a real source, and
     `StatCard` takes an optional `format` for the money figures (added in Unit 13).
   - **`getUnreadCount` is already implemented and exported** from `lib/services/notifications.ts`,
     with the whole-inbox semantics a dashboard KPI needs. Do not build a second one.
   - `GET /api/members/lookup` and `loansApi.list` already serve the Unit 12 UI; do not
     build second versions. `getMemberUnpaidFineTotal` already serves the issue gate.

### Unit 14 — spec checklist, ticked against the running app
- [x] Cannot reserve while a copy is effectively available; can when all copies out or held.
      *A two-copy book with one copy on loan and the other held reads `effectiveAvailable: 0` and
      **is** reservable — the shelf copy is already spoken for, which is exactly the situation a
      queue exists for. My first assertion had this backwards twice before I read the rule again.*
- [x] Duplicate reservation and limit (3) rejected; active-loan duplicate rejected. *"You already
      have … on loan"* names the specific mistake, not *"every copy is out"*.
- [x] Returning the last copy promotes the oldest waiting reservation to `ready`; the copy is not
      issuable to another member.
- [x] Expired holds become `expired` and the next in line is promoted, with a fresh hold window.
- [x] Staff fulfil issues the loan and marks the reservation `fulfilled`; member issue via the desk
      also fulfils their ready hold. *Both were asserted against the database, not the response.*
- [x] Renewal is blocked when someone is waiting.
- [x] Catalog availability counts reflect holds, and the badge says *"None available"* rather than
      *"All N out"* — with a hold, "all out" is false.
- [x] Responsive; light/dark OK · no TypeScript or console errors · `npm run build` passes.

### Unit 14 — bugs found by reading the screenshots
Found the way Unit 07's truncated category names were found: **every assertion passed while all
three of these were wrong**, because none of them looked at what a user would see.

- **The staff register silently truncated itself at 50 rows with no pager and no note.** A
  librarian with four hundred closed holds saw fifty and nothing saying three hundred and fifty
  existed — the *"a capped list must say it is capped"* rule, already written down from the Unit 10
  member record. Only the **History** tab is ever long, and it was invisible because the seeded
  data had 22 rows. Added pagination plus a `Page 1 of 2 · showing 50 of 88` footer, and seeded 60
  closed holds so the screen is exercised at a size that matters — with a handful of rows, both
  the register and the member's Past section look complete whether or not they are.
- **Book titles rendered as "No longer in the…"** in the register. `w-full` on a seven-column table
  hands the slack to the narrow columns and starves the one a librarian actually reads. Fixed with
  `min-w-[13rem]` — and that in turn **pushed the actions column out of the `overflow-hidden`
  wrapper**, silently clipping the row menu, so the two date columns were merged into one two-line
  "Dates" cell to buy the space back. Both facts are still shown, on vertical space the row already
  had going spare. There is now a check on `table.scrollWidth` against the wrapper, because an
  `overflow-hidden` table that outgrows its box clips the last column with nothing to indicate it.
- **A placeholder book was still a link.** `bookRefOr` returns `slug: ""` for a missing book — a
  real state, since a reservation outlives its book — and an empty slug produced `href="/catalog/"`,
  landing a librarian on the catalog listing having asked for a book that is not there. Placeholders
  now render as plain text, and there is a check for `a[href="/catalog/"]`.

### Unit 14 — bugs found by the build and by reading the code
- **`getReadyHoldCounts` was read from inside a transaction without the session.** `issueLoan`
  asked "how many copies are promised to somebody else?" from outside the snapshot the rest of the
  transaction was reasoning about, so a hold promoted by a concurrent return could be invisible to
  the very issue that was supposed to respect it. `tsc`, `eslint` and `next build` all passed: the
  parameter simply did not exist to be wrong.
- **The first member to reserve a book was told they were "#2 in line".** `getQueueInfo` advanced
  its counter *and then* added one. Found by the browser pass asserting on the rendered sentence,
  and only because the harness asserted on the **place**, not on "a reservation exists".
- **The queue position had two contradictory definitions.** `ReservationSummary.queuePosition`
  returned a number for a `ready` hold and `QueueEntry.position` returned `null` for the same row —
  two shapes for one concept, disagreeing. Both are now non-null only while `waiting`.
- **`reservation.expire` would have needed a fabricated actor.** `logAudit` takes `actor`, and there
  is no `system` role. Writing a row would have repeated the Unit 13 `createFineIfLate` mistake, so
  the sweep writes no audit entry and the notification carries the fact instead.

### Unit 14 — deliberately not done
- **`reservation.expire` audit rows**, as above.
- **Pagination on the member's `/reservations`.** It has none because the screen has no page
  controls at all: `ready` and `waiting` are bounded by policy (at most `maxReservationsPerMember`
  open holds) and `past` is capped with its total reported. A real pager would be a control that
  can never be pressed.
- **A prune for reservations whose book has been deleted.** The app cannot create that state —
  `deleteBook` refuses while active holds exist — but earlier units' QA deleted books directly in
  Mongo and left rows behind. They render honestly via `bookRefOr`. Cleaning them is a data
  operation on the developer's database, not a code change, so it is reported rather than done:
  see the Open Questions note.

### Unit 14 — harness notes
- **A fixture that violates a database rule is caught by the database, not by the pass.** The first
  `QA Out Multi` fixture put two active loans on the same book for the same member and Mongo refused
  the whole insert with `E11000 … loan_one_active_per_member_book`. That is business rule 1 working
  exactly as designed; the two copies had to go to two different members.
- **A document written by the app looks nothing like a document written by a fixture.** Filtering
  for the `__qa14` flag found nothing, because holds created *through the API* during the pass carry
  no flag — the same lesson as Unit 08's leftover books. Scope a cross-cutting query by a real
  field (the member id), not by the fixture marker.
- **JSON still does not survive a PowerShell argument**, and `-Compress` makes it worse:
  `{ok:true}` rather than `{"ok":true}`. Pass fixtures as a **file path** and let each harness
  `readFileSync` it.
- **`node file.js` with top-level `await` needs `.mjs`** when the QA folder's `package.json` has no
  `"type": "module"`.
- **A harness must report what already passed when it crashes.** The first crashing version printed
  only the stack trace, which threw away every check that had run and cost a full debugging cycle.
  The report moved into a `.finally()`.
- **Seed the volume the feature has to handle.** Every capped-list bug in this project was invisible
  because the fixtures were smaller than the cap.

### Unit 12 — bugs found by the developer using the page
Reported as "all four tabs are broken and I cannot issue a book". **Two entirely different
causes**, which is why they arrived in one report.

- **Every loan tab returned 500 — a missing `await`, mine.** `listLoans` called
  `buildFilter(query, now)` on an **async** function without awaiting it, so a `Promise`
  reached `Loan.find()`, and Mongoose reported:
  `ObjectParameterError: Parameter "filter" to find() must be an object, got "[object Promise]"`.
  `buildFilter` is async because the free-text branch awaits two id lookups; returning an
  object from it made the `await` look unnecessary. **Neither `tsc` nor `eslint` catches
  this**, because Mongoose's filter parameter is typed loosely enough to accept a Promise.
  Confirmed by the running server's own log, not by guessing from the browser stack.
  Fixed with the `await` and a comment explaining why it is load-bearing.
- **Issuing a book failed on the replica-set limit — environmental, not a code defect.**
  `POST /api/loans/issue -> MongoServerError: Transaction numbers are only allowed on a
  replica set member or mongos`. Deliberately **not** worked around: a non-transactional
  fallback would quietly reintroduce the exact data-corruption race the unit exists to
  prevent, which is worse than a loud failure. **Now resolved** — see below.
- **The duplicate-loan check ran *after* availability, giving the wrong reason.** A
  one-copy book the member already holds satisfies both refusals. Checked in the old order,
  a librarian who double-issued was told *"Every copy is on loan"* — true, and useless,
  because returning the copy would clear that message while the actual mistake went
  unmentioned. The duplicate check now runs **first**, so the refusal names the thing they
  have to fix. It is also the cheaper query. Caught by asserting on the *message*, not the
  status code: the 400 was already correct.
- **The desk overflowed horizontally at 390px by 36px.** Both search panes are grid items,
  and **a grid item defaults to `min-width: auto`**, so it refuses to shrink below its
  content. The selected-member and selected-book cards are wide (avatar + truncated name +
  status badge), so the implicit track sized to max-content. `min-w-0` on both items lets
  the track shrink and the `truncate` children do their job. Only visible with the issue
  ticket open, which is why the first overflow probe found nothing — **measure the state
  the user was actually in.**
- **The desk tab labels overflowed too.** `"Active loans"` in a `w-fit` `inline-flex`
  trigger row pushed the page 36px wide. The section heading already says "Loans", so the
  word was redundant as well as too long; now `"Active"`, which fits at 360px too.
- **"Issue a book" silently did nothing.** The deep link carries `?memberId=<ObjectId>`,
  and the desk looked the member up with `membersApi.lookup` — which searches **name,
  email and membership ID**, not `_id`. An ObjectId matches none of them, so the lookup
  returned an empty list and the desk arrived with nobody selected and no error. The fix
  was to **fetch the record** with `membersApi.get`. `lookup` and `get` have confusingly
  similar names and different semantics, which is what invited the mistake.
- **A generated book cover rendered clipped words at small sizes.** `GeneratedCover` always
  used `p-4` and body-size type, so at 56px — about 24px of content — "Structure and
  Interpretation of Computer Programs" became "Str / and / Har" over three lines. At 32px
  the same component left *no* room and the text was invisibly clipped, which is why the
  row covers looked fine and only the issue-ticket cover looked broken. Below 72px the
  fallback now drops the type entirely and renders a flat category tint, which is the
  honest result at that size.

### The replica set is now a replica set
The local `mongod` was a standalone, so no transaction could commit and the circulation
engine was untestable. Resolved by:
1. appending `replication: { replSetName: rs0 }` to
   `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg` — **backed up first, and
   auto-restored if `mongod` did not come back up**, because a malformed config would
   otherwise leave the developer with no database at all;
2. `Restart-Service MongoDB`;
3. `rs.initiate()` via the project's own `mongodb` driver — deliberately **not** elevated,
   keeping the privileged surface to a config edit and a restart.

Verified: `setName: rs0`, primary elected, and a transaction commits.

### Verified live after the fixes
- **Circulation round trip, 31 checks** — issue decrements `availableCopies` by exactly 1
  and increments `borrowCount`; due date is `today + loanPeriodDays`; duplicate issue is
  refused with the right sentence; renew extends by exactly `renewalExtensionDays` and
  increments `renewCount`; the renewal **limit** is enforced and the message names it;
  return restores the copy and sets `returnedAt`; a second return is refused; all four tabs
  return 200.
- **Authorisation, 17 checks** — a member gets **403** on `GET /api/loans`,
  `POST /api/loans/issue`, `POST .../return` and `GET /api/team`; `GET /api/loans/mine` is
  200 and shows only their own rows; **a member renewing another member's loan is 403** with
  "You can only renew your own loans", and the same member renewing **their own** loan is
  200, so the 403 is not just "renew is broken".
  - The first version of this check **passed for the wrong reason**: it issued the loan *to*
    the probing member and then asserted they could not renew it. Issuing to someone and
    refusing their renewal is a test that proves nothing.
- **Browser, 13 checks** — desk renders with loan rows; no failed requests; the ticket's
  checklist shows all five rows with the fine check honestly `unknown`; **no horizontal
  overflow at 390px or 768px**; the member record carries the "Issue a book" link and the
  desk arrives with the member preselected; **0 console errors, 0 page errors**.

### Unit 12 — deliberately not done
- `createFineIfLate` is still a Unit 11 stub, so a late return raises **no fine**. The desk's
  Return dialog previews one from the policy and says so honestly, but the real document is
  Unit 13's job. `promoteReservationQueue` and `fulfilReadyReservationIfAny` are likewise
  no-ops (Unit 14), so a returned copy is not yet offered to the member waiting for it.
- The policy checklist checks four of five rules client-side; the fine check is `unknown`.
- **The local database change is not in git.** `mongod.cfg` lives outside the repo, so a
  fresh clone on another machine is standalone again and circulation will 500 there. It is
  recorded in this tracker and should go into the README's setup steps before Unit 21.

### Unit 09 — Public Catalog & Book Detail ✅
- `src/app/(public)/layout.tsx` — a public shell deliberately **not** `AppShell`: a visitor
  has no sidebar, breadcrumbs or notifications, and rendering an authenticated nav for
  someone who cannot use it is worse than none. The session is read from the **cookie
  only** (no database round trip), purely to choose between "Sign in" and initials, so a
  page any anonymous visitor can reach stays cheap. `PublicNav` (sticky, translucent,
  border appears on scroll, in-flow mobile panel) and `PublicFooter` (three columns whose
  links are real catalog shortcuts rather than a second nav bar).
- **Service additions** — `getReadyHoldCounts`, `withAvailability`, `getCatalogBook`,
  `listRelatedBooks`, `getCatalogFacets`.
  - **`effectiveAvailable` is real, not a stub.** The spec suggested stubbing it, but the
    reservation collection already exists and the query is one round trip, so returning
    zeros would have left a number the catalog displays for Unit 14 to remember to fix.
  - **`availability=available` is filtered after fetching, and that is documented as a
    deliberate trade-off.** The predicate is `availableCopies − readyHolds > 0` across two
    collections; a `$lookup` inside `find()` cannot be followed by the `skip`/`limit`
    Mongo needs to paginate correctly. Filtering *after* `skip`/`limit` would make the
    total a lie and let "Next" show an empty page, so the matching set is fetched, filtered
    and then sliced.
  - `listRelatedBooks` ranks by `borrowCount`, then rating, then title, with `_id` last —
    "more in this category" is only useful if the suggestions are actually related.
  - Facet counts are over **active** books and are deliberately **not** narrowed by the
    other filters: a facet that renumbers itself as you type reads as options vanishing.
- **API** — `GET /api/books` gained `availability`, `yearFrom`, `yearTo` (an inverted
  range is a 422, not a silent empty result); new `GET /api/books/facets` and
  `GET /api/books/:id/related`; `GET /api/books/:id` now returns the **catalog** shape
  (`effectiveAvailable`, `queueLength`, `userState`) that the detail page needs, while the
  staff edit form keeps reading `getBook()` server-side for raw counts. An archived book
  404s on `/related` too, so it cannot advertise its neighbours.
- **UI** — `CatalogBrowser` (SWR keyed on the filters, desktop sticky filter column and a
  mobile bottom `Sheet` rendering the **same** `CatalogFilterPanel`), `BookCard` (whole card
  is the link; availability overlaid on the cover), `BookListRow` (list mode shows year,
  publisher, page count and a description snippet the grid has no room for),
  `AvailabilityBadge` (one pip per copy, falling back to text above 12 so a 999-copy
  textbook does not render 999 elements), `StarRating` (clipped overlay fill, so 4.3 shows a
  precisely 30%-filled fifth star instead of rounding to 4), `ReadMore` (measures whether it
  actually overflows rather than clamping to a guessed height), `CatalogToolbar` with an
  `aria-live` result count, `useCatalogFilters`.
- `useCatalogFilters` copies Unit 08's **focus-owns-the-value** rule for the debounced
  search box rather than rediscovering it, and adds the per-kind history rule (discrete
  filters `push`, search `replace`s). `view` (grid/list) is **deliberately not in the
  URL** — it is a presentation preference, and every shared link would otherwise carry the
  sender's screen choice; it persists to localStorage instead.
- Verified against the local MongoDB: `/catalog`, `/catalog?sort=title`, a detail page and
  all three new/changed API routes return 200; facets return correct per-category counts,
  icons, languages and a 1969–1996 year range; `availability=available` drops 33 → 32 and
  removes the one book with no free copy; a 1990–2000 year filter returns 1 book; an
  inverted range is a 422. `tsc`, `eslint` and `next build` all clean.
- **Deliberately not wired:** Reserve (Unit 14) and the wishlist (Unit 15). The buttons
  render with the label they will have and a tooltip saying when they open, rather than
  shipping controls that silently do nothing. Share *is* live (Web Share API with a
  clipboard fallback), because a share link is genuinely useful for a catalog today.

### Unit 07 — Categories ✅
- `lib/validators/category.ts` — `CATEGORY_ICON_NAMES` (**42-icon curated whitelist**), `createCategorySchema`,
  `updateCategorySchema`, `categoryIdSchema`, and `slugify` (shared with the Unit 21 seed script).
  Icon is a `z.enum` over the whitelist, so a typo in the whitelist itself is a compile error.
- `lib/services/categories.ts` — `listCategories` (one `$lookup` aggregation counting **active** books),
  `createCategory`, `updateCategory` (re-slugs on rename, supports an explicit `reslug`), `deleteCategory`
  (blocked while **any** book references it, with the count in the message). All three audited, updates
  carrying `before`/`after`. Create and update both return `bookCount`.
- Routes: `GET /api/categories` (**public** — catalog filter + landing showcase), `POST`, `PATCH /:id`,
  `DELETE /:id` (staff). Every handler goes through `handler()` → `requireStaff()` → zod → one service call.
- `src/lib/icons.ts` is now the single name→component map. `CATEGORY_ICON_COMPONENTS` is typed
  `Record<CategoryIconName, LucideIcon>` (not `Record<string, …>`) and is resolved at **module scope**, so a
  stored icon name can only ever resolve and its identity never changes. The loose `CATEGORY_ICONS` /
  `categoryIcon` / `categorySwatch` helpers were removed — two sources of truth for the same mapping is how
  they drift.
- `components/common/category-icon-tile.tsx` — the accent tile shared by the card and the dialog preview, so
  `bg` and its matching `on` ink can never diverge. Built with `createElement` because
  `react-hooks/static-components` (React Compiler) rejects a whitelist lookup bound to a JSX tag during
  render; the reference comes from a frozen module map, so it is a false positive, not a real remount risk.
- `components/features/categories/*`: `categories-manager` (SWR + optimistic writes with rollback),
  `category-card` (staggered entrance, `MoreHorizontal` menu), `category-dialog` (RHF + zod, keyed so
  values come from props with no reset effect), `icon-picker` (searchable 42-tile grid), `color-swatch-picker`
  (six accents, tick marks the selection so it does not rely on colour alone).
- `src/hooks/use-roving-radio.ts` — real APG radiogroup behaviour for both pickers: arrow keys move the
  selection, Home/End jump, arrows wrap, and only the checked option sits in the tab order so a 42-tile grid
  never swallows 42 tab stops. The icon search always keeps the current selection visible, so the group can
  never end up with nothing checked and nothing focusable.
- Card layout is **vertical** (tile + menu on one line, name/description full width). The grid is 1 → 2 → 3
  columns. This replaced a side-by-side tile that left ~95px for the heading and truncated nearly every
  category name to "Art…".
- **Verified end to end against a real local MongoDB** (33 API checks + 106 browser checks, 0 page errors,
  0 failed requests): create/edit/delete, duplicate name as an inline field error, delete blocked while
  books exist, live icon + colour preview, arrow-key swatch navigation, optimistic rollback, audit entries
  in the database, 360/768/1280 × light/dark, CLS 0.0000, no overflow, no clipped card text, reduced motion,
  menu focus management.
  - The only console entries are the **intentional** 409 (duplicate name) and 400 (blocked delete) responses
    Chrome logs for any non-2xx fetch.
  - Follow-up pass on the dialog UX: 16/16 checks · 0 console errors, 0 page errors, 0 failed requests ·
    Save visible at every viewport · Save disabled until dirty · Escape / Cancel / outside-click all guard
    dirty input · "Keep editing" restores every edit · "Discard" creates nothing · clean Escape closes
    immediately · body scrolls while the title and footer stay pinned · confirmation copy free of em dashes.

### Unit 06 — Cloudinary Uploads & Profile ✅
- **Module split** (documented in `architecture.md`, must not be merged):
  `lib/cloudinary-shared.ts` is client-safe (no `server-only`, no SDK); `lib/cloudinary.ts` is server-only
  and lazily `await import("cloudinary")` for `signUpload` / `destroyAsset`. Merging them, or importing
  the server module from a Client Component, fails the build — a loud failure that prevents shipping
  `CLOUDINARY_API_SECRET` to the browser.
- `signUpload()` signs `timestamp`, `folder`, `allowed_formats` **and `max_file_size`**, so the client
  cannot widen the constraints. Upload endpoint is rate-limited to 30/hour per user per folder.
- `POST /api/uploads/sign` — zod enum folder whitelist; `covers` requires staff (403 for members).
- `DELETE /api/uploads` — staff may delete `athenaeum/covers/*` (detaching it from any referencing book
  first, with an audit entry); a member may delete **only their own current avatar**, verified against the
  database. Both branches are audited.
- `PATCH /api/profile` — read-only fields (email, membership ID, role, status) are absent from the schema
  and assigned one-by-one, so zod key-stripping plus explicit assignment blocks mass assignment.
- `ImageUploader` — dashed drop zone, drag-over highlight, instant blob preview, determinate progress bar
  via `XMLHttpRequest` (the only browser API that reports upload progress), success tick, remove with
  confirm. MIME **and** extension **and** size validated client-side as a fast UX check.
- Profile page — two columns (identity card + avatar / Details & Security tabs), read-only fields shown
  behind a lock with the reason, strength meter on the new-password field, `/profile` reachable by every
  role with the shell variant chosen from the role.
- **Security review (agent)**: no CRITICAL/HIGH findings. Confirmed blocked — crafted `publicId`
  deletion, member cover upload, `..` traversal, signature widening, SDK/secret in the bundle, NoSQL
  injection, mass assignment, secret/stack-trace leakage. Fixed during the pass:
  - **MEDIUM** — avatar `url` was client-controlled and rendered to other users via a raw `<img>`;
    now **derived server-side from the `publicId`**, removing the attack surface entirely.
  - **LOW** — added a rate limit to signing; added audit entries to both delete branches; derived the
    covers prefix from `folderPath()` instead of a literal.
- **Verified in headless Chrome**: 64/64 checks · **0 console errors, 0 page errors, 0 failed requests** ·
  360/768/1280 × light/dark · CLS 0.0000 · no overflow · all four `/api/profile` + `/api/uploads` routes
  reject anonymous calls · non-image and >3MB files rejected with a clear message · `accept` excludes SVG
  · membership ID rendered in mono · Details/Security tabs switch · three password fields present ·
  **`CLOUDINARY_API_SECRET` / `api_secret` / `apiSecret` absent from every client bundle and the HTML**.

## Bugs Found and Fixed by Browser QA
Recording these because they were invisible to `tsc`, `eslint` and `next build`:
- **`PasswordInput` swallowed `className`** — it applied the class to its wrapper `<div>` instead of the
  `<input>`, so the Lock icon sat on top of the password text.
- **`TextField` never padded custom controls** — `padded` was defined as `Boolean(Icon) && !Control`, so the
  `control` branch that receives `className` could never receive the padding.
- **Checkbox pointer target was 18px** — below WCAG 2.2 SC 2.5.8. Added a transparent `::before` overlay
  taking it to 24px.
- **Sidebar collapse did nothing visually** — `AppShell` hard-coded `w-[264px]` on the `<aside>`, so the
  rail collapsed *inside* a fixed box. Fixed by lifting the preference into a `SidebarState` context that
  both `AppShell` and `Sidebar` read.
- **`server-only` leaked into the client bundle** — `ImageUploader` imported `UPLOAD_LIMITS` and
  `withTransform` from the server module, dragging in the SDK and failing on `fs`. Fixed by the
  `cloudinary-shared` / `cloudinary` split above.
- **Every upload would have failed with `Invalid Signature`** — `max_file_size` was signed but never sent.
  Caught by the security-review agent, not by any compiler.
- **A newly uploaded avatar was never persisted** — `onChange` only touched client state and the next
  server refresh clobbered it, leaving the API's avatar branch as dead code. Now calls `profileApi.update`.
- **A revoked blob URL latched forever** — `preview` was set once and never cleared, so after the first
  upload the preview pointed at a dead object URL and masked the real image.

### Unit 09 — bugs found after the developer reported an empty `/catalog`
The developer came back with "why doesn't /catalog show the books". Both causes were mine,
and **both were invisible to `tsc`, `eslint` and `next build`**, and the first one also
survived a plain HTTP check because the page server-renders a healthy-looking shell.

- **The catalog never fetched anything — the Unit 08 SWR bug, reintroduced verbatim.**
  The fetcher was `(signal?: AbortSignal) => catalogApi.list(query, signal)`, but **SWR calls
  `fetcher(key)`**, so `signal` received the *string cache key* and it went straight into
  `fetch`:
  `Failed to read the 'signal' property from 'RequestInit': Failed to convert value to 'AbortSignal'`.
  No request was ever issued; the page showed "The catalog could not be reached" with the raw
  browser error as the description. Unit 08 hit this exact bug on the staff table, wrote a
  warning about it, and I wrote it again an hour later. Fixed with the same hand-rolled
  `AbortController` (the fetcher takes **no parameters**), and both call sites now carry the
  note.
  - **Why nothing caught it:** `Invoke-WebRequest /catalog` returns **200 with 77KB of
    correct-looking HTML** — the heading, the search box, the whole filter panel with live
    facet counts — because those are all server-rendered. Only the results are client-fetched,
    so an HTTP status check and a build both pass while the page is functionally empty. The
    earlier verification only asserted on status codes and bytes, which is exactly the
    assertion shape that cannot see this class of bug.
- **`effectiveAvailable` was missing from the default list, so every card read "NaN of 1
  available".** I attached it in the `availability=available` branch and in
  `listRelatedBooks`, and forgot it in the ordinary paginated branch. Two compounding causes:
  1. `listBooks` declared its return type as `BookListItem[]`, which does **not** include
     `effectiveAvailable`, so nothing downstream was type-checked against the field the
     catalog actually reads. `CatalogBook` is now the declared return type.
  2. The field was attached at **three** call sites rather than in one serialiser, so
     adding it anywhere meant remembering to add it everywhere else. Every list result now
     leaves through one `serialiseAll`.
  - The earlier check passed because it asserted on `?availability=available`, which is the
     one branch that happened to be correct. **A check that only exercises the branch you just
     wrote is not a check of the feature.**

### Unit 09 — bugs found by build and smoke check
- **`container-page` had no working max-width on any page.** The `@utility` block read
  `max-width: var(--container-7xl)` and `--container-7xl` was never declared, so the
  declaration was invalid at computed-value time and every page fell back to `max-width:
  none`. Invisible up to 1280px — the viewport is the constraint anyway — and wrong on
  every larger screen, which is how it survived seven units of responsive QA. Now
  declared as `80rem` in the `@theme inline` block.
- **`.extend()` on a refined Zod schema is a runtime error.** Adding the inverted-year-range
  check to `listBooksQuerySchema` made `staffBooksQuerySchema`'s `.extend()` throw
  *"Cannot overwrite keys on object schemas containing refinements"*. `tsc` and `eslint`
  were both clean; only `next build` failed, during page-data collection. `safeExtend` is
  the correct call and the reason is now recorded on the schema.
- **`useSearchParams()` is a build error in a prerendered route, not a warning.** The
  catalog opted into the CSR bailout and killed the build. Declared
  `export const dynamic = "force-dynamic"` rather than wrapped in a `<Suspense>` boundary:
  a filterable catalog is per-request anyway, so a static shell buys nothing, and the
  boundary would cost a visible spinner plus a subtree replacement that discards whatever
  the user has already typed — exactly the Unit 08 login-page bug. The detail page reads
  `params` rather than `searchParams` and stays statically renderable.
- **`getSession()` returns only `{ sub, role, name }`.** The public navbar originally wanted
  an avatar, which is not in the token; reading the user record on every public page load
  would put a database round trip in front of every anonymous visitor, so the navbar shows
  initials from `name` instead. Anything needing a live record goes through
  `requireSession()`.
- **The root page shipped a disabled catalog link** (`aria-disabled`, `tabIndex={-1}`, "opens
  in Unit 09"). Correct as a placeholder, wrong to leave behind once the route existed.

### Unit 08 — Books (bugs found by browser QA)
Every item here passed `tsc`, `eslint` and `next build`. None was reachable from an API test.

- **The books table never fetched anything.** The SWR key was `searchParams.toString()`, and
  **SWR treats an empty-string key as "do not fetch"** — so the first load of `/staff/books`,
  which has no query params, issued no request at all. The page rendered a confident
  *"No books yet · 0 books"* over a catalog of 32 books. The key is now `pathname + "?" + query`,
  which is always truthy. A page that renders a confident empty state is the most expensive kind
  of bug: it looks correct.
- **The fetcher received the cache key as its `signal`.** SWR invokes `fetcher(key)`, so a
  fetcher declared `(signal?: AbortSignal) => …` was handed the **string key** and passed it
  straight to `fetch`: `Failed to read the 'signal' property from 'RequestInit'`. Only visible
  once the empty-key bug above was fixed and a request actually fired. Cancellation is now wired
  by hand with an `AbortController`, and the fetcher deliberately takes no parameters.
- **Every unauthenticated visit to a protected page 404'd.** `proxy.ts` built the login redirect by
  assigning `url.pathname = "/login?next=/staff/books"`, and a *path* percent-encodes its `?`, so
  the browser went to the literal route `/login%3Fnext%3D%2Fstaff%2Fbooks` and got the not-found
  page. It survived the Unit 05 pass because the assertion was `url.includes("/login")`, which the
  mangled URL still satisfies — **the test confirmed a string, not a destination.** It now builds
  the query with `searchParams.set`, and the pass asserts on the destination path, the presence of
  the login form, and the round-tripped `next` value.
- **The edit form could never be saved for a book with a year or a page count.**
  `<input type="number">` makes react-hook-form store a JS **number**, while `publishedYear` and
  `pageCount` were declared `z.string()`. The form failed its own resolver with
  `expected string, received number` and silently refused to save — for most books in a catalog.
  Both now accept `string | number`, exactly as `totalCopies` always did. A schema that disagrees
  with its own input element is invisible to every static check.
- **A brand-new book could never be created at all.** `language` was seeded with `""` while the
  schema requires `min(1)`, so a user who never touched the language picker could not submit.
  Defaults to `"English"` now; an existing book keeps its stored value.
- **The search box silently ate the first characters typed.** Three separate attempts failed the
  same way, and the reasons differ enough to be worth writing down:
  1. *"When `q` changes, copy it into `draft`"* — this fires for the hook's **own** debounced
     write. Typing `Le Guin` over ~200 ms commits `L` 350 ms in, and `L` overwrites a draft that has
     already reached `Le Guin`.
  2. *Tracking "the last value I wrote"* — `router.replace` settles a **render late**, so for one
     render `useSearchParams()` still returns the previous query. That is indistinguishable from an
     external change, so the draft was cleared. Observed as `?q=Ln` and `?q=LGuin`.
  3. The fix is **focus as the signal**: while the box has focus the user owns the value and the
     debounce only moves the URL; once focus leaves, the URL wins. It cannot misfire on the lagging
     URL, and it still covers Back, Reset and shared links.
- **The unsaved-changes guard blocked the form's own post-save redirect.** `form.reset()` followed
  by `router.push()` in the same tick leaves the listener installed with `dirty === true`, and
  Next's router fires `navigate` *during* the push. The save succeeded, the redirect was cancelled,
  and the user was left on the form they had just saved with no indication anything happened. The
  host now calls `allowNavigation()` first. The flag is deliberately **not** consumed on first use,
  because Next can emit more than one `navigate` per push and a self-clearing flag let the second
  one block "Discard changes" instead.
- **The discard prompt never opened.** `blockedHref` was recorded but nothing rendered from it, so
  clicking a sidebar link on a dirty form swallowed the click silently and the form looked frozen.
  One piece of state now drives both the intercept and the prompt.
- **A hydration mismatch on the auth pages.** `useReducedMotion()` returns `null` on the server but
  resolves to the real media query on the **first client frame**, so the variant set could differ
  between server HTML and the hydrated tree. This was masked while the login page sat behind a
  `<Suspense>` spinner (so the form never server-rendered); removing that fallback — see below —
  exposed it. `usePrefersReducedMotion()` now folds in `useIsHydrated()`.
- **Passing Mongoose documents to a Client Component.** `listCategories()` returns lean documents
  whose `_id` is an `ObjectId`, and React refuses to serialise anything with a `toJSON` across the
  RSC boundary: *"Only plain objects can be passed to Client Components from Server Components."*
  An `as unknown as CategorySummary[]` cast made `tsc` and `next build` pass while the page threw at
  render. Fixed by serialising with `toCategorySummary` — the same serialiser the API route now
  uses — and the cast is gone. **A cast at this boundary defeats the only check that catches it.**
- **Pagination could show the same book twice and skip another.** Every sort ended in a
  non-unique field, so books sharing a `createdAt` to the millisecond (a bulk import, a seed script)
  had no defined order and Mongo is free to return them differently between page 1 and page 2. All
  six sorts now end in `_id`.
- **`next build` was clean while the search box could not be typed into.** Found by the harness
  asserting on the *URL* after typing rather than trusting the pass.
- **Model caps disagreed with the validator** (title 300 vs 200, shelf 40 vs 20, pageCount
  unbounded vs 10000), so the validator accepted input the schema rejected and the user saw a
  generic 500 instead of a field error.
- **Removed the `<Suspense>` spinner from the login page.** It existed only so `useSearchParams`
  could work in a prerendered page; `?next=` is now read in the Server Component and passed as a
  prop. That removes the visible spinner flash on the most-used page in the app *and* the subtree
  replacement behind it.
- **`data-scroll-behavior="smooth"`** was added to `<html>` because `globals.css` sets
  `scroll-behavior: smooth` and Next.js logs a warning (and animates route scrolls) without it.

### Unit 04/06/07 — earlier units
- **`PasswordInput` swallowed `className`** — it applied the class to its wrapper `<div>` instead of
  the `<input>`, so the Lock icon sat on top of the password text.
- **`TextField` never padded custom controls** — `padded` was `Boolean(Icon) && !Control`, so the
  `control` branch that receives `className` could never receive the padding.
- **Checkbox pointer target was 18px** — below WCAG 2.2 SC 2.5.8. Added a transparent `::before`
  overlay taking it to 24px. A harness measuring `getBoundingClientRect` therefore **cannot** see
  the compliant target; it must read the pseudo-element too.
- **Sidebar collapse did nothing visually** — `AppShell` hard-coded `w-[264px]` on the `<aside>`,
  so the rail collapsed *inside* a fixed box. Fixed by lifting the preference into a `SidebarState`
  context that both `AppShell` and `Sidebar` read.
- **`server-only` leaked into the client bundle** — `ImageUploader` imported `UPLOAD_LIMITS` and
  `withTransform` from the server module, dragging in the SDK and failing on `fs`.
- **Every upload would have failed with `Invalid Signature`** — `max_file_size` was signed but never
  sent. Caught by the security-review agent, not by any compiler.
- **A newly uploaded avatar was never persisted** — `onChange` only touched client state and the next
  server refresh clobbered it, leaving the API's avatar branch as dead code.
- **A revoked blob URL latched forever** — `preview` was set once and never cleared, so after the
  first upload the preview pointed at a dead object URL and masked the real image.

### Unit 07 — Categories (post-review fixes)
Reported by the developer after the first commit, then verified in the browser:
- **Save was unreachable on most laptops.** The dialog measured **1034px tall** and `DialogContent` has no
  height cap and centres itself with `translate-y-[-50%]`, so on any viewport under ~1040px the title was
  clipped off the top and the **Save button sat below the fold with nothing to scroll**
  (`scrollable: false`, `canScrollToSave: false` — genuinely unreachable, not merely awkward). Fixed by
  capping the dialog at `max-h-[calc(100dvh-2rem)]`, making the middle region the only scroll container
  (`overflow-y-auto overscroll-contain`), and pinning the action row. This is the "sticky action footer for
  long forms" rule in `ui-context.md`; it was not being applied. Verified at 1920×1080, 1440×900, 1366×768,
  1280×720 and 1024×640.
- **Clicking "Keep editing" submitted the form.** Replacing the action row with the discard prompt
  unmounted the form's **only submit button**, and a form with none falls into the implicit-submission
  path: the real mouse click fired `SUBMIT` and created a category the user was trying to abandon
  (reproduced with an event log — `CLICK <BUTTON type=button> "Keep editing"` immediately followed by
  `SUBMIT`). Fixed by moving the prompt to its **own pinned row under the header** so the submit button is
  never unmounted; it is also disabled while the prompt is showing. Note: a synthetic `el.click()` did
  *not* reproduce this — only a real mouse click, so the harness must not use `el.click()` for this check.
- **Unsaved edits were dropped silently.** Escape, the close button, Cancel and a click outside now all
  route through `requestClose()`, which asks before discarding. `Escape` on a clean form still closes
  immediately. The prompt is a row rather than a nested `AlertDialog`, because nesting a modal inside a
  Radix dialog strands focus.
- **Save is now disabled until the form is dirty**, so the button's state tells the user whether there is
  anything to save.
- **Confirmation copy cleaned up** per the developer's request: the em dashes are gone from both branches of
  the delete confirmation, rewritten as plain sentences.

### Unit 07 (additions)
- **`PATCH /api/categories/:id` silently wiped `icon` and `color`** — the highest-risk bug of the unit, and
  it passed `tsc`, `eslint` and `next build`. `updateCategorySchema` was built with
  `createCategorySchema.partial()`, and **Zod 4's `.partial()` keeps an inner `.default()`**: renaming a
  category reset its icon to `BookOpen` and its colour to `forest`. Confirmed with a runtime probe before
  changing anything (`PATCH {name}` → `{name, icon:"BookOpen", color:"forest"}`), then fixed by composing
  both schemas from shared field schemas that carry **no** defaults. A duplicate-name check that only
  exercises `POST` will never catch this — the pass asserts a rename *preserves* both fields.
- **`tailwind-merge` treated the type-scale tokens as colours** — `cn("text-primary-foreground",
  "text-small")` classified `text-small` as a text colour and **deleted the colour class**, so elements
  silently inherited body text and lost their contrast. Fixed by registering the eight tokens in
  `extendTailwindMerge({ classGroups: { "font-size": [...] } })` in `lib/utils.ts`. Affects every
  `cn()` call in the app, not just categories.
- **Category glyphs failed WCAG AA** — the tile used `text-primary-foreground` on the category accent, which
  flips with the theme: 3.5:1 on terracotta in light and **1.4:1 on forest in dark**. Fixed by adding the
  theme-independent `--cat-ink-light` / `--cat-ink-dark` tokens (documented in `ui-context.md`) and routing
  every accent surface through `CATEGORY_COLOR_CLASS[color].on`.
- **`accent-foreground` was white on terracotta** (3.7:1, fails AA) → dark warm ink.
- **Card names were truncated to "Art…"** — a side-by-side icon tile inside a four-column grid left ~95px
  for a 20px serif heading. Caught only by reading the screenshot, not by any assertion: every check passed
  because none of them looked at the heading. The card is now vertical and the grid is 1 → 2 → 3 columns,
  and the pass now asserts `scrollWidth <= clientWidth` on every card heading and paragraph.
- **Mojibake shipped to the screen** — the confirm dialog rendered the opening and closing curly quotes as
  `A-circumflex / euro / oe-ligature` triplets, i.e. `Delete` + three mangled glyphs + `Science Fiction?`.
  The em dashes and the smart quotes were **double-encoded**: UTF-8 bytes decoded as Windows-1252 and
  re-written as UTF-8, in 7 files from earlier units (`image-uploader.tsx` even had a mangled separator in
  the visible copy, reading `WebP` + two bad glyphs + `up to 3MB`). Repaired by reversing the transform with
  a byte table derived from Node's own `windows-1252` decoder, applied per line and only where the result
  is valid UTF-8 that no longer contains the signature. The pass now asserts that none of the four tell-tale
  code points (`U+00C2`, `U+00C3`, `U+00E2`, `U+FFFD`) appears in the rendered text.
  - Root cause to avoid repeating: **do not round-trip a source file through PowerShell
    `Get-Content -Raw` + `Set-Content`.** It reads as the system ANSI codepage, so every non-ASCII character
    is corrupted and a BOM is added. Use the editor tools instead.

### Unit 10 — bugs found by the build and by reading the code
- **`server-only` leaked into the client bundle again.** `validators/members.ts` imported
  `isValidMembershipId` from `lib/services/membership.ts`, which is `server-only` and imports
  `mongoose`. The suspend dialog and the member forms import that validator, so the build
  pulled mongoose and the whole driver into the browser. `tsc` and `eslint` both passed —
  **only `next build` caught it**, the same shape as the Unit 06 Cloudinary split. Fixed by
  moving the *format* into a new client-safe `lib/membership-id.ts`, which the service now
  imports, so generation stays server-side and the pattern is reachable from both sides. The
  general rule: a validator is client code, so **nothing it imports may be `server-only`.**
- **The generated password could index past the end of its alphabet.** The first version built
  one combined `ALPHABET` string and then called `randomIndex(52)` for a letter and
  `randomIndex(10)` for a digit. The alphabet has 52 letters and 8 digits, so the digit index
  range was 52–61 against a 60-character string — **two of ten draws returned `undefined`**,
  producing a 9-character password that failed the very policy it was generated to satisfy.
  Nothing catches this: indexing returns `undefined` rather than throwing, and the result is a
  valid `string` after `join`. Fixed with explicit `FIRST_DIGIT_INDEX` bounds and a
  Fisher-Yates shuffle so the guaranteed letter/digit are not always in the same positions.
- **A failed password reset was completely silent.** `ResetPasswordDialog` held the error in
  component state, but `ConfirmDialog` **always** calls `onOpenChange(false)` once `onConfirm`
  settles — so the state was unmounted before it ever painted and the dialog just closed,
  looking like nothing had happened. Now a toast. The general rule: a caller of `ConfirmDialog`
  **cannot** surface an error inline, because it has already been unmounted by the time it
  would render.
- **A hard-coded `maxActiveLoans` in the members table.** `LoanCount` escalated the badge tone
  at `count >= 5`, duplicating `SETTINGS_DEFAULTS.maxActiveLoans`. That number is editable at
  runtime by an admin (invariant 7), so the component would have been correct only until
  someone changed the policy, and would then have warned on the wrong members — worse than not
  warning. There is no client-side settings accessor yet, so the tone is uniform and the
  threshold is left to land with one.
- **`StatCard` takes a component, not an element.** Four KPI tiles were first written
  `icon={<IdCard className="size-4" />}`; the prop is `React.ComponentType<…>`, so the JSX
  element failed to type-check. Worth knowing because passing an element *would* work at
  runtime for most icons and silently lose the size/stroke defaults the component applies.
- **`AuthenticatedUser.id` is a `Types.ObjectId`, not a string.** The team page passed it
  straight to a client component whose rows are keyed by string ids, so the "is this you?"
  comparison would never have matched and the admin could have been offered the action that
  disables themselves. `.toString()` at the boundary, not an `as string` cast.

### Unit 10 — bugs found by the developer using the pages
Both reported after the unit was committed, and both passed `tsc`, `eslint` and `next build`.

- **The detail tabs showed "arrives with the circulation work" instead of the member's data.**
  Loans, Fines and Reservations were rendered as placeholders on the reasoning that those
  units had not been built. **That reasoning was wrong.** The `Loan`, `Fine` and `Reservation`
  collections, their schemas and their indexes have existed since Unit 02 — the data was
  there to read, and `getMemberDetail` was already counting from it. So the screen showed a
  confident, well-formatted statement that it had nothing to show, over a database holding the
  member's loan and hold.
  - `getMemberDetail` now returns the rows as well as the counts, capped at
    `MEMBER_HISTORY_LIMIT` (50) and newest-first, with the **counts left exact** so the UI can
    say "showing the 50 most recent of 340" rather than implying the list is everything.
  - Book titles and covers are resolved in one `$in` query into a `Map`, mirroring
    `categoryMap` in `services/books.ts`, rather than a `$lookup` per row.
  - **The derived loan state is computed in the service, not the component.** `on_time` /
    `due_soon` / `overdue` do not exist in the database (invariant 4), so `loanView()` is the
    single place that derives them — exported, because Unit 11/12 renders the same states and
    must not grow a second copy of the rule.
  - `LoanDisplayState` was added rather than reusing `LoanView`. `LoanView` is the *filter*
    vocabulary that `api-contract.md` defines (`active | returned | overdue | due_soon`); a loan
    out on time has no filter of its own, and reusing `LoanView` would have painted an
    "active" badge on a loan that is entirely in good standing.
  - **Queue positions are counted from one ordered read** of the queues for the books involved,
    not one query per hold. The sort is `createdAt: 1, _id: 1` to match the FIFO index, with
    `_id` as the tiebreaker — without it two holds created in the same millisecond have no
    defined order and the same hold reports a different position on each load.
  - `MemberRecord` lives in `types/index.ts` and both the service and `api-client` alias it.
    `MemberDetail` had been declared separately in each, which is how the Unit 08 payload drifted.
  - **Verified live** against the local MongoDB: `activeLoans=1, totalBorrowed=1, unpaidFines=0,
    activeReservations=1`, the loan row carries its real book title with `view=on_time` and ISO
    dates, and the waiting hold reports `queuePosition=1`.
  - Worth knowing when looking at this screen: **the developer's own account has no loans, fines
    or reservations**, so their record shows correct empty states. The QA member
    `Mia Member` (LIB-2026-9001) is the one with a loan and a hold.
- **The reset password was never shown.** Clicking "Reset password" produced a success toast and
  then nothing at all — no password, no error, nothing to copy. The API was fine: the envelope,
  `request()` and `membersApi.resetPassword` were all correct, and the service returned the
  password. The value was being **destroyed in the client on the way to the screen**.
  - `ConfirmDialog.handleConfirm` captures `onOpenChange` from the render in which the button was
    clicked, then awaits `onConfirm()` and calls `onOpenChange(false)` to dismiss itself. Our
    handler read `!pending` from that **stale closure** — where `pending` was still `false`,
    because the reset had not started when the click was captured — so it took the "user
    cancelled" branch and called `close()`, which cleared `revealed`. The reset had succeeded, the
    toast fired, the password was in state, and the dialog's own auto-close wiped it before the
    reveal could render.
  - Fixed with a **ref** written synchronously on success, not by reading `revealed`. Reading
    state would not have worked: the handler is stale by construction, so `revealed` still reads
    `null` in it no matter when React re-renders. The ref is immune to that.
  - **Not confirmed in a browser.** The 200-draw stress test on the generator was cut short by
    the developer, so the reveal is verified by construction and by the reported symptom being
    explained end to end — not by watching it render. Worth one manual click through at Unit 21.

### Unit 10 — upgraded after the developer's feedback
Two pieces of the team screen were placeholders rather than features. Both are now real.

**Renaming a staff account was a `window.prompt`.**
- One line of `window.prompt("New name for this staff account:", member.name)` guarded by a
  length check. It looked like a browser dialog *inside* the app, so it broke the theme at
  exactly the moment an admin was editing staff; it had no field-level validation, only a
  toast after the fact; it had no discard guard, so Escape threw the text away silently; and
  it asked for a name without showing whose name, or reminding the admin that the name is what
  appears in the sidebar and the audit trail.
- Replaced by `RenameTeamMemberDialog`, following the `CategoryDialog` pattern line for line
  because that one was already fixed for three separate Unit 07 bugs:
  live identity preview (the avatar's derived initials update as you type, which is cheaper
  than explaining the initials rule), a **pinned discard row** rather than a second modal,
  `requestClose()` on every close path, Save disabled until dirty, one scroll region with a
  pinned footer, and the email and role shown as **read-only facts with the reason** — because
  "why can't I change the email here?" is the obvious next question when renaming someone.
- **The name rule is now one schema.** `staffNameSchema` is composed into
  `createStaffMemberSchema`, `updateTeamMemberSchema` and `renameTeamMemberSchema`. Three
  copies of `min(2).max(80)` is three places for the limit to drift, and drift there means the
  form accepts a name the API rejects with a generic 500 — the Unit 08 model-cap mismatch again.
- `renameTeamMemberSchema` is a plain object, **not** `updateTeamMemberSchema` reused: that one
  carries a `.refine()` requiring *a name or a status*, which is right for a PATCH and
  meaningless for a form whose only field is the name.

**There was no way to create an administrator.** Only `createLibrarian`, with the role
hard-coded.
- `POST /api/team` now takes an optional `role` and `createStaffMember` honours it.
  **`role` defaults to `librarian`**, so a caller that forgets the key cannot mint an admin by
  accident; creating one has to be deliberate.
- **Only an admin may create an admin**, checked in the service as well as the route. Minting
  an administrator is the one action on this screen that hands over the ability to change
  library settings and disable other staff, so it does not rely on a single caller.
- **Role is still not editable.** `updateTeamMemberSchema` rejects `role`, so promotion and
  demotion both remain impossible by design; the supported route to gaining an administrator
  is creating one, which writes an audit entry naming the actor who authorised it. The
  last-admin refusal message was corrected from "Promote another librarian to admin" — advice
  the app offers no way to follow — to "Add another administrator".
- **One "Add staff" dialog with an explicit role choice, not a second header button.** Two entry
  points to one form is two places for the copy to drift, and it would make granting full
  authority feel like a routine click. Picking the role inside the dialog puts the capability
  difference in front of the person deciding, and the privileged choice shows a warning
  stating that the account can disable other staff *including yours*.
- `RolePicker` uses **native `<input type="radio">`** inside a `<label>`, not a grid of styled
  buttons. The browser already implements everything an ARIA radiogroup promises: one tab stop,
  arrow keys, correct accessibility tree. `useRovingRadio` exists for *button* grids that have
  to supply that behaviour themselves, and pairing it with real radios would handle every
  arrow keypress twice with the two implementations disagreeing about what is selected.
  Selected and focused states are drawn with `has-[:checked]` / `has-[:focus-visible]` on the
  label, so they follow the real input instead of duplicated state that could disagree with it.
  Each card lists its **capabilities** ("can manage books…") rather than denials, because a
  list of absent power does not help someone deciding.
- Create-dialog Save tracks `isValid`, not `isDirty`: there is no persisted record to differ
  from, and the pre-filled generated password would otherwise make the form permanently dirty.
- **`TEAM_ROLES` was deleted from the validator.** `lib/constants.ts` already exported
  `STAFF_ROLES` for exactly this, so the validator had a second name for the same array —
  the duplication rule from the Unit 08 payload drift, waiting to happen. Worth noting it was
  also declared *below* the schemas, so any schema referencing it above would have been a
  temporal-dead-zone crash on the first import from a route.

**Verified live against the local MongoDB** (25 checks, all passing):
- omitted `role` → `librarian`; `role: "admin"` → `admin`; `role: "member"` → 422
- a newly created administrator **signs in** with the supplied password and comes back with
  role `admin`; a librarian likewise signs in as `librarian`
- a librarian calling `POST /api/team` gets **403**, and `GET /api/team` gets 403
- duplicate email → 409 naming the `email` field; weak password → 422
- `team.create` is audited for both roles, the entry records the role, and the entry contains
  no password material
- **the sparse-index rule was proved, not assumed**: two documents written with
  `membershipId: null` fail with duplicate-key `E11000` on `membershipId: 1`, while the staff
  documents the service actually writes omit the key and both insert fine. The API reports
  `membershipId: null` on read because of the `?? null` projection, which is a *read* fallback
  and not evidence that `null` was stored.
- rename verified separately: 22 API checks and 35 browser checks (dialog opens, live preview
  tracks typing, inline validation, discard guard, Save reachable at 1024x640 and 390x844, real
  save persists), 0 page errors, 0 console errors.

### Unit 10 — harness lessons worth keeping
- **`click({ clickCount: 3 })` does not select an input's text in headless Chrome.** Typing
  appended instead of replacing, which renamed a real admin to `"Athenaeum AdmihgAda LovAelace"`
  and cascaded into four false failures that all looked like product bugs. Ctrl+A + Backspace +
  type then ate the first two characters and dropped the tail (`"Athenaeum Admihg"` → `"henaeum
  Admihg"`). **Set the value through `HTMLInputElement.prototype`'s native setter and dispatch
  one `input` event** — what testing libraries do, and deterministic.
- **A harness that renames real data must restore it in a `finally`, and must print before and
  after.** Two runs left the database dirty before that was added.
- **Assert on a specific node, not on a page's `textContent`.** `/\bAL\b/` failed to match
  because the initials are glued to their neighbours in the concatenated string; reading
  `[data-slot="avatar-fallback"]` was both specific and correct.
- A failing **screenshot write** (`UNKNOWN: unknown error, open …png`) is the harness, not the
  page. The developer had already confirmed the feature worked before that run.

### Unit 10 — deliberately not done
- **The reset-password reveal still needs one manual click-through.** Everything else in this
  unit was checked live; that one was fixed by construction and confirmed by the reported
  symptom being explained end to end, not by watching it render.
- `GET /api/members/lookup` is built and returns real rows, but nothing consumes it yet. It
  exists for the Unit 11/12 circulation desk, which is the only screen that needs type-ahead.
- The per-tab **actions** are not there yet, by design: issuing a book, taking a fine payment
  and cancelling a hold all belong to Units 11/12/13/14. Each tab says which screen will do it
  rather than showing a button that does nothing.

## In Progress
- **Unit 17 — Dashboards.** Not started. `StatCard` (with its optional `format`), the staff
  layout's throttled maintenance hook, and the KPI data all exist; `GET /api/dashboard/member`
  and `/api/dashboard/staff` are the missing pieces, plus both dashboard screens.
- Unit 16 — Notifications. **Committed as WIP with one known defect** (the maintenance
  transaction abort). Everything else in the unit works. See above for the narrowed-down cause
  and the concrete next step.

## Open Questions
- **`POST /api/maintenance/run` aborts its transaction intermittently** — the one open defect in
  the codebase. See the Unit 16 WIP section for the narrowed cause and the concrete next step.
  Everything else in Unit 16 is working and browser-verified.
- **The local dev database holds orphaned reservations** — roughly 30 rows whose `book`, and in
  several cases whose `member`, no longer exists. They are left by Units 08–13's QA deleting
  books and users **directly in Mongo**, which bypasses `deleteBook`'s refusal to remove a book with
  active holds. The app renders them honestly ("No longer in the catalog", "Unknown member"), and
  they make `/staff/reservations` look like a screen full of failures. **Not cleaned**: it is an
  irreversible delete on the developer's data, so it is reported rather than done. One line clears
  them if wanted — `db.reservations.deleteMany({ book: { $nin: db.books.distinct("_id") } })` —
  but the developer's call.
- Final product name (default "Athenaeum"). Rename in Settings + `lib/constants` when Unit 19 lands.
- Default currency (default USD, editable in Settings).
- `MONGODB_URI` already points at a running **local** MongoDB, converted to a single-node replica
  set (`rs0`) so circulation transactions commit. **`mongod.cfg` lives outside the repo**, so
  another machine is standalone again and circulation will 500 there — the setup steps must go in
  the README before Unit 21. Every unit has now been verified against a real database, Units 11–15
  including their transactions.
- **A dev server was already running on port 3000 when Unit 14 started.** It was healthy and
  connected, so the pass reused it rather than starting a second one — two `next dev` processes in
  one project fight over the Turbopack cache, and deleting `.next` under a live server makes every
  route look like a 404. It then exited on its own mid-session and a fresh one was started. The
  session notes still hold: **check port 3000 before starting anything.**
- Confirmed against the spec: **suspended members may still edit their profile and avatar.**
  `architecture.md` §Auth & Access Model says "Wishlist and profile edits remain allowed", and
  `requireActiveMember()` is reserved for reserve / renew / issue. `PATCH /api/profile` therefore uses
  `requireSession()`, not `requireActiveMember()` — intentional, not an oversight.
  - **A suspended member keeps their place in a queue.** `GET /api/reservations/mine` uses
    `requireSession()`, not `requireActiveMember()`: being suspended stops them borrowing, not
    reading. They cannot *join* one (`POST` uses `requireActiveMember`), which is the rule.
- The project has **no test files**. `project-overview.md` scopes automated suites out, but Units 06 and 07
  each found bugs that any test would have caught (broken signature, avatar never persisted, PATCH wiping
  icon and colour), and Unit 14 found two more that only reading a screenshot caught. Worth revisiting
  at Unit 21.
- The browser QA harness lives outside the repo in `%LOCALAPPDATA%\Temp\opencode\qa` (puppeteer-core plus
  the installed Chrome), so no QA dependency is added to the project. Unit 08 added `bootstrap08.mjs`
  (fixtures), `books-api.mjs` (73 checks), `books-page.js` (129 checks), `books-audit.mjs` and
  `run-unit08.ps1`. **Unit 14 added `bootstrap14.mjs`, `reservations-api.mjs` (74 checks),
  `holds-page.mjs` (43 checks) and `run-unit14-existing.ps1`** — the last reuses whatever dev server
  is already healthy instead of starting one. **Unit 15 added `bootstrap15.mjs`, `reviews-api.mjs`
  (67 checks), `reviews-page.mjs` (55 checks) and `run-unit15.ps1`**, which reuses a healthy server,
  seeds, runs the API pass, **re-seeds**, then runs the browser pass. **Unit 16 added
  `bootstrap16.mjs`, `notifications-api.mjs`, `notifications-page.mjs` and `run-unit16.ps1`**
  (same shape), using puppeteer-core against the installed Chrome.
- **A dev server that has been running since before your edits will serve stale code and report
  it as a fresh bug.** This cost two full debug cycles on Unit 16: a 500 that persisted after the
  fix was because PID 740 had been serving since before the change and never picked it up. When
  a fix appears to change nothing, **check the server's start time before re-reading your own
  code.** Killing it requires the whole process tree (`npm` → `next` → `next-server`), and
  `.next` must be removed afterwards or every route 404s.
- **`node --check` on a `.mjs` with top-level `await` reports errors that are not there**, and
  PowerShell echoes them to stderr alongside real failures — read the exit code, not the stream.
- **A fixture that cannot reach the state its test is about reports bugs that are not there.**
  Unit 16's queue-promotion test failed first because the fixture had the book fully out on loan,
  so there was correctly no free copy to promote into. Check that the fixture can actually
  produce the state before believing the failure.
- **Fixtures must be data the app would actually accept.** A made-up ISBN in a seed document does not
  fail loudly; it makes the *form* the thing under test, and the pass then reports a save failure instead
  of a fixture mistake. All fixture ISBNs are checksum-valid, and are verified as such.
- **Fixtures must not leak between runs**, and **a fixture written by the app carries no fixture flag.**
  Books created *through the app* have no `__qa` marker, so deleting only flagged documents let them
  accumulate; a stray title sorted ahead of `Kindred` and failed an alphabetical assertion that was
  actually correct. `bootstrap08.mjs` deletes by `__qa`, by `addedBy ∈ QA users`, and by a `^QA` title
  prefix. `bootstrap14.mjs` tags `__qa14` and deletes by it, and asserts on **member ids** rather than
  the flag wherever a query crosses into app-written rows.
- **The local database is nearly empty of activity.** As of this unit it holds 43 books, 2–3 members with
  no history, and ~90 closed reservations, most of them orphaned (see above). Every screen that renders
  loans, fines or reservations will therefore look empty for most accounts, which reads as "broken"
  rather than "no data yet". Before browser QA on any of those screens, seed realistic activity (an
  overdue loan, a paid fine, a waived fine, a ready hold) or you are testing the empty state and
  calling it a pass.
- **JSON does not survive a PowerShell argument** — `{a:"b"}` arrives as `{a:b}`, and
  `ConvertTo-Json -Compress` makes it worse by dropping the key quotes. **Pass structured data as a
  file path** and read it inside the harness.
- **`$env:` does not persist between tool calls.** Re-seed the fixtures *and* re-export the fixture
  reference in the same command as the test that needs it, or the ids will not match the database.

## Architecture Decisions
- Next.js 16 App Router (scaffold) + Mongoose 9 + Cloudinary signed uploads + jose JWT cookie sessions.
- **A sparse unique index treats an *absent* field as absent but a stored `null` as a value.** So
  `Book.isbn` and `User.membershipId` carry **no `default`**, writers omit the key, and readers use
  `?? null`. A default on either field silently limits the catalog/library to one such record.
- **A Server Component must serialise service output before passing it to a Client Component.**
  Lean Mongoose documents carry a `toJSON` and React refuses to cross the boundary with them. Use
  `toCategorySummary` / `toApi`; **never a cast**, which hides it from the only check that catches it.
- **Wire shapes live in `types/index.ts`, once.** The service produces them and `api-client` consumes
  them; two local copies drifted and produced a type error with no visible cause.
- **Every list sort ends in a unique tiebreaker.** Non-unique sort keys make pagination
  non-deterministic when rows share a timestamp.
- **Schema field types must match what the control actually produces.** `<input type="number">`
  yields a number to react-hook-form; a `z.string()` field then fails its own resolver.
- **Filter history is per-kind:** discrete filter changes `push`, a debounced search box `replace`s.
- **SWR cache keys must never be empty** — an empty-string key means "do not fetch".
- **SWR calls `fetcher(key)`, so a fetcher must declare no positional parameters.** Declaring
  `(signal?: AbortSignal) => …` receives the *string key* and hands it to `fetch`, which
  throws *"Failed to convert value to 'AbortSignal'"*. This bit the staff table in Unit 08 and
  the catalog in Unit 09; cancellation is wired by hand with an `AbortController`.
- **A list endpoint must have exactly one serialisation path.** Attaching a derived field at
  three call sites means adding it everywhere next time. One `serialiseAll`, and the return
  type declares the derived fields so omitting one is a compile error.
- **A client-fetched region is invisible to an HTTP status check.** `/catalog` returns 200
  with a complete-looking shell while the results are client-side only. Assert on the rendered
  result — a card count, a row of titles — not on a status code and a byte length.
- Animation imports from `motion/react`; all timings live in `src/lib/motion.ts`.
- Status colours ship as `-soft` tint + `-ink` foreground pairs to satisfy WCAG 2.2 AA.
- Custom form controls receive `className` on the **input**, not a wrapper, so icon padding composes.
- Controls keep a ≥40px pointer target even when the painted box is smaller (switch 24px, checkbox
  18px), via a transparent `::before` overlay.
- The style guide lives at `/styleguide` behind a `(styleguide)` route group; a leading-underscore folder
  is a Next.js private folder and is excluded from routing.
- **Icon names are whitelisted in `lib/validators/category.ts` and resolved only in `lib/icons.ts`.** The map
  is built at module scope and typed `Record<Name, LucideIcon>`, so a stored name can neither fail to
  resolve nor change identity between renders. A dynamic `import()` keyed on user input is never used.
- **Long dialogs cap at `max-h-[calc(100dvh-2rem)]` with a pinned action row.** `DialogContent` has no
  height cap and centres itself with `translate-y-[-50%]`, so any dialog over ~1000px pushes its own
  footer off-screen on a laptop with no way to scroll to it. Long *pages* use the same idea with a
  `fixed` action footer and matching `pb-32` on the form.
- **A validator is client code.** Nothing a file in `lib/validators/` imports may be `server-only`,
  because client forms import those schemas. Put the *rule* in a client-safe module and have the
  server service import it (`lib/membership-id.ts`), rather than the reverse. This is the same
  class of bug as the Unit 06 `cloudinary-shared` split, and it is only visible to `next build`.
- **A caller of `ConfirmDialog` cannot show an inline error.** It closes itself as soon as
  `onConfirm` settles, so any error state is unmounted before it paints. Report failures with a
  toast, or use a controlled `Dialog`.
- **`ConfirmDialog`'s `onOpenChange(false)` is ambiguous: a dismissal *or* a successful
  confirm.** Its handler runs after `onConfirm` resolves, from a closure captured when the button
  was clicked, so **every piece of state it reads is stale**. A caller that has to distinguish the
  two cases must write a **ref** synchronously inside `onConfirm`, not read state. Reading state
  is what made the reset dialog destroy the password it had just generated: the reset worked, the
  toast fired, and the dialog's own auto-close then cleared the result.
- **"This data belongs to a unit that hasn't been built" is usually the wrong conclusion — check
  the collection first.** The Unit 10 detail tabs rendered "arrives with the circulation work"
  placeholders while `Loan`, `Fine` and `Reservation` had existed since Unit 02. A confident
  empty panel is worse than an empty one, because it tells the user the app is finished here.
  Deferring a *feature* is fine; claiming there is no *data* is a separate claim, and it needs
  checking against the database.
- **A generated credential must be verified against its own validator.** A one-off alphabet with
  index ranges that do not line up produces `undefined` characters and a value that is too short,
  and neither a compiler nor an index access will complain. Generate from one module, bound the
  ranges explicitly, and prefer a rejection-sampled CSPRNG over `Math.random`.
- **Never hard-code a policy threshold in a component.** `maxActiveLoans`, `maxRenewals` and the
  fine limits are editable at runtime (invariant 7). Until a client-side settings accessor exists,
  show the number without threshold-dependent tone rather than showing it against a stale constant.
- **Derive derived state in the service, not the component.** `overdue` and `due_soon` are not
  stored (invariant 4), so any screen showing a loan has to derive them. Doing it in the render
  means the member record and the circulation desk can answer "is this late?" differently.
  Derive once in the service and put the result on the wire; keep the filter vocabulary
  (`LoanView`) and the display vocabulary (`LoanDisplayState`) as separate types, because a loan
  out on time has no filter but does have a display state.
- **A capped list must say it is capped.** Returning the newest 50 rows beside an exact total and
  rendering no note reads as "this is everything". Compare the row count against the limit.
- **A vertical action footer stacks on mobile.** `DialogFooter` is `flex-col-reverse
  sm:flex-row`, so `me-auto` (copied from `CategoryDialog`) applies to the *column* axis below
  `sm` and strands a narrow Cancel at the bottom-left instead of a full-width one. Use
  `sm:me-auto` plus `w-full sm:w-auto` on both buttons. **`CategoryDialog` still has the original
  `me-auto` and the same mobile flaw** — not fixed here to keep this commit to the rename flow,
  and worth a one-word pass at Unit 21.
- **`click({ clickCount: 3 })` does not select an input's text in headless Chrome.** Typing
  appends instead. Set the value through `HTMLInputElement.prototype`'s native setter and dispatch
  one `input` event — what testing libraries do. A harness that writes real data must also
  restore it in a `finally`.
- **Never ship `window.prompt`/`window.confirm` inside the app.** An OS dialog cannot be styled,
  so it breaks the theme at the moment of use, has no field-level validation, and discards input
  on Escape without warning. It is a console tool, not a UI.
- **Never reach for "the obvious next question" as a reason to leave a gap.** The rename dialog
  shows email and role as read-only facts *with the reason they are fixed*, rather than hiding
  them and letting the admin wonder. The same reasoning retired "promote another librarian to
  admin" — advice the app offered no way to follow — in favour of "add another administrator".
- **Two entry points to one form is a bug.** A single dialog with an explicit choice is better
  than two buttons that open it: the copy cannot drift apart, and a privileged choice stays a
  deliberate act instead of becoming a routine click.
- **Granting authority needs three things**: a default to the safe value, an explicit confirmation
  of the consequence, and an audit entry naming who authorised it. Default `role` to
  `librarian`, warn on `admin`, and let only an admin create one.
- **Prefer a native control when it already implements the accessibility contract.** A native
  radio group gives one tab stop, arrow keys and a correct tree for free. Reaching for
  `useRovingRadio` *on top of* native radios handles every arrow keypress twice. That hook is
  for styled button grids, which is what `color-swatch-picker` and `icon-picker` are.
- **A `const` referenced by an earlier module-level initialiser is a TDZ crash on import.**
  `TEAM_ROLES` sat below the schemas in `validators/members.ts`; any schema using it above would
  have failed the first time a route imported the module. Declare shared constants first.
- **One name for one list.** `STAFF_ROLES` already existed in `lib/constants.ts`, so the
  validator's `TEAM_ROLES` was a second name for the same array. Delete the duplicate rather than
  importing both.
- **A conditional update, not a read-then-write, is what makes a count safe.** Issuing a
  book takes a copy with `{ availableCopies: { $gt: 0 } }` + `$inc`, so two simultaneous
  requests for the last copy cannot both succeed. Returning a copy uses
  `{ $expr: { $lt: ["$availableCopies", "$totalCopies"] } }` + `$inc`, because **a `$lt`
  cannot compare two fields of the same document** and checking in application code reopens
  the race. Both deliberately bypass document validators; the filter guard is stronger,
  since Mongo refuses the whole update when the condition fails.
- **A stub is only safe when its "no data" answer is the permissive one.** `countOtherReservations`
  was specced as a stub, but `0` would have let renewals through on books other members are
  queuing for. Check what a stub *permits*, not just what it returns.
- **Count calendar days, not 24-hour periods, wherever money depends on it.** A book due at
  23:00 yesterday and returned at 01:00 today is one day late. Whole 24h blocks charged
  nothing for it, and `daysOverdue × ratePerDay` followed the wrong number.
- **Round a countdown *up*, and derive it on the server.** `hoursUntilExpiry` exists because the
  alternative is "0 hours left" while a copy is still on the shelf with the member's name on it.
  Deriving it on the server also means one rounding rule: the member's page, the record tab and
  the register cannot disagree, and no component re-implements it.
- **A `ready` hold is counted in the FIFO order but never numbered.** Three copies returned means
  the first person still waiting is #4 — true, because three people are served before them. But a
  member whose copy is already set aside is not waiting for a place, and giving them `#1` labels
  two members #1 on the same book. Two shapes for one concept with different nullability is how a
  register and a sheet disagree about the same row; both now use the same helper and the same rule.
- **MongoDB has no nested transactions, so a service that opens its own must expose the body.**
  `issueLoan` / `issueLoanInSession` are the pair. Anything else that needs to issue *inside* an
  existing transaction (Unit 14's fulfil is the first) would otherwise either fail or — far worse —
  commit outside the caller's transaction, leaving the invariant the transaction exists to enforce
  quietly unenforced.
- **Put the shared primitives in a leaf, not in the service that reads most naturally.** The queue
  mechanics could not live in `services/reservations.ts` because `circulation.ts` needs them and
  `reservations.ts` needs `circulation.ts`. `hooks.ts` is the leaf, for the same reason `refs.ts`
  is. Cycles in a service graph resolve at *call* time in ESM, so they mostly work — which is
  worse than failing, because they work until a `const` is hoisted and read at module scope.
- **A hook called from inside a transaction must take the session.** `getReadyHoldCounts` was read
  from `issueLoan` without one, so the hold count came from outside the snapshot the rest of the
  transaction was reasoning about: a hold promoted by a concurrent return could be invisible to the
  very issue meant to respect it. Nothing catches a missing parameter.
- **An automatic action has no actor, so it writes no audit row.** Inventing a `"system" as never`
  is what Unit 13 got wrong on `createFineIfLate`. The state change plus the member's notification
  is the record; invariant 11 does not list expiry.
- **An empty `slug` is a signal, not a value.** `bookRefOr` returns `slug: ""` for a book that is
  gone, and a reservation genuinely outlives its book. Rendering that as `<Link href={`/catalog/${slug}`}>`
  produces `/catalog/` — a different page. Placeholders render as text.
- **A capped list must say it is capped *and* offer a way past the cap.** `meta.total` beside a
  one-page `items` array is what tells you; `items.length` can never tell you. This bit the staff
  register at exactly 50 rows and was invisible because the fixtures held 22 — seed the volume the
  feature has to handle.
- **A `w-full` table hands its slack to the narrowest columns and starves the one a human reads.**
  Fixed with `min-w` on the book column, which then over-corrected and pushed the actions column
  out of an `overflow-hidden` wrapper — silently clipping the row menu. **Assert
  `table.scrollWidth` against the wrapper's `clientWidth`**: an `overflow-hidden` table that
  outgrows its box clips the last column with nothing to indicate it.
- **A comma-separated `status` filter beats three requests for one tab.** A tab assembled from
  three calls is a lie the moment one of them fails; omitting the filter is unbounded.
- **Pass fixtures to a harness as a file path, not as JSON in an argument.** PowerShell strips the
  double quotes, and `ConvertTo-Json -Compress` strips them too.
- **Hooks called inside a transaction must take the `session`.** A stub that opened its own
  connection would write outside the transaction, which is the failure the transaction
  exists to prevent.
- **Never add a "no transactions available" fallback for multi-document writes.** It would
  quietly break the invariant the code exists to enforce and produce a rare data bug that
  is far more expensive than a loud 500. Fix the environment instead.
- **A validator may check shape but never policy.** A `zod` `.max(5)` on an active-loan
  count freezes the policy into the transport layer and silently disagrees with an admin who
  changes it in Settings (invariant 7).
- **Probe the deployment before building on a capability the docs assume.** `db.admin().hello`
  answers whether a replica set exists in one query; finding out by issuing a book is worse.
- **An `async` helper's return value must be awaited at the call site, and a function that is
  async only for one branch is a trap.** `buildFilter` returns an object but is `async`
  because its free-text branch awaits, so `buildFilter(...)` looks like a plain call. The
  symptom was `Parameter "filter" to find() must be an object, got "[object Promise]"` on
  every loan tab — and **no type checker catches it**, because Mongoose types the filter
  parameter loosely. Rule of thumb: if a function is `async`, always `await` it, or do not
  make it `async`.
- **A browser stack trace for a 500 points at the request, not the bug.** The real cause was
  only in the dev server's own log. Read `.next/dev/logs/next-development.log` before
  theorising — it has the actual exception while the console only has `INTERNAL`.
- **A grid item defaults to `min-width: auto`, so it will not shrink below its content.**
  A wide child inside a grid cell sizes the implicit track to max-content and pushes the
  whole page into a horizontal scroll — 36px past a 390px viewport here, with the row and
  card layouts both looking fine. `min-w-0` on the item lets the track shrink and the
  `truncate` children do their job. **Measure the state the user was actually in**: the
  overflow only appeared once the issue ticket was open, and a probe on the plain page
  found nothing.
- **`w-fit` cannot wrap.** Four tab triggers in an `inline-flex w-fit` list overflow a narrow
  viewport rather than reflowing. Shorten the labels: a redundant word in a tab is both too
  long *and* duplicated from the section heading.
- **Check what a search endpoint actually searches.** "Look up this member" was implemented
  as `membersApi.lookup(ObjectId)` against an endpoint that matches **name, email and
  membership ID** — so it returned an empty list, the deep link silently did nothing, and
  there was no error to notice. `lookup` and `get` are confusingly similar names for
  different semantics.
- **A component that renders text must respond to its own size.** `GeneratedCover` hard-coded
  `p-4` and body-size type, so below ~72px it produced "Str / and / Har". At 32px it left no
  room and clipped invisibly — so the *same* component looked fine in a table and broken in a
  ticket. Below the threshold, render the flat tint and let the adjacent title carry the text.
- **Assert on the message, not the status code.** The duplicate-issue 400 was already correct
  but carried the wrong explanation, because availability was checked before the duplicate
  rule. Status-code assertions cannot see a *wrong reason*; a status code of 400 for a
  different cause still passes.
- **Check the specific rule before the general one.** Both refusals were true, but "you
  already have this on loan" is the one naming the mistake, and it is also the cheaper query.
- **A test that issues a record to the actor and then asserts the actor cannot act on it
  proves nothing.** The first authorisation check for renewals did exactly that and passed
  for the wrong reason. Assign to a *third* party.
- **Changing an infrastructure service needs a backup and a self-rollback.** The elevated
  script that edited `mongod.cfg` copied it first and restored it if `mongod` did not come
  back up. A malformed config would otherwise have left the developer with no database, and
  "the fix was a one-line edit" is exactly the kind of statement that hides that risk.
- **Keep the privileged surface minimal.** The config edit and service restart needed
  elevation; `rs.initiate()` did not, so it ran unelevated from the project's own
  `mongodb` driver. Fewer elevated steps, less to go wrong, easier to explain.
- **Prove the sparse-index rule instead of asserting it.** Two documents with `membershipId: null`
  fail with duplicate-key `E11000` on `membershipId: 1`. An API response of
  `membershipId: null` is the `?? null` *read* fallback and is not evidence about storage —
  the stored document has to be inspected.
- **`export type { X } from "@/types"` does not bring `X` into local scope.** A file that
  both re-exports and uses a type needs the separate `import type` as well.
- **Store async results keyed by the term that produced them, and derive visibility.**
  This is the React 19 answer to "don't `setState` synchronously in an effect": instead of
  clearing results in the effect's early-return branch, compare the stored term with the
  current one during render. A stale list can then never paint, with no flash and no
  effect-driven state write. Applies to every debounced search.
- **Clamp a derived index during render, not in an effect.** A shorter result list must not
  leave the highlight past its end — but correcting it with `setState` in an effect is the
  same lint violation as everything else, and slower. Derive it.
- **One `choose` path for click and Enter.** When the two interactions live in different
  places, "clear the list after choosing" reliably gets applied to one of them.
- **Never read or write a ref during render.** `react-hooks/refs` catches both. The pattern
  that satisfies it and stays correct: write the ref in an effect, read it in an event
  handler.
- **A remote picker must choose rows on `onMouseDown`, not `onClick`.** The input's blur
  unmounts the list, and `onClick` fires after that.
- **Type an optional sub-resource as a hand-written subset, never as the full document.**
  `PublicSettings` is `Pick<SettingDoc, …>` on purpose: it is a display endpoint, and a field
  added to the settings singleton later must not be exposed by accident.
- **A client-side policy check that cannot be verified must be `unknown`, not a green
  tick.** The member lookup returns no fine total, so the fine check renders as unknown —
  a checkmark asserting something nothing has checked is the one a member would be most
  upset to get wrong. Preview checks are for **enabling a button**, never for blocking one;
  the server's sentence must be able to win.
- **A disabled button must carry its reason.** In `title` *and* as visible or `sr-only`
  text, because a `title` alone is unreachable by touch and by keyboard.
- **Never unmount a form's only submit button.** A form with no submit button falls into the
  implicit-submission path, where a real mouse click on a `type="button"` inside it submits anyway. Keep the
  submit button mounted and disable it instead of swapping it out. Related: `el.click()` does not
  reproduce this class of bug — use a real mouse event in the harness.
- **A dirty form must guard every close path**: Escape, the close button, Cancel and click-outside. Route
  them through one `requestClose()` so none can discard input silently. Do not nest a second modal for the
  confirmation — it strands focus inside a Radix dialog; use a pinned row instead.
- **A guard must be able to stand down for a navigation the host initiates itself.** `dirty` is React
  state and cannot be cleared synchronously, so `reset()` + `router.push()` in one tick is still
  "dirty" when Next fires `navigate`. The host calls `allowNavigation()` first, and the flag is
  cleared when the form becomes clean rather than on first use, because Next can emit more than
  one `navigate` per push.
- **`Field`'s `<label for>` must target a real control.** The pickers pass an explicit `htmlFor` (the icon
  search input, and the *selected* colour swatch — a `<button>` is a labelable element), so clicking a
  field label lands on the current control instead of dead-ending.
- **Roving tabindex is a shared hook** (`useRovingRadio`) rather than per-picker logic. Any ARIA
  `radiogroup` in this app must implement it: only the checked option is tabbable, arrows move the selection.
- **Accent-coloured surfaces use a fixed ink, never `primary-foreground`.** The category hues do not flip
  per theme, so their foregrounds must not either. See `ui-context.md` §Accent inks.
- **Never round-trip a source file through PowerShell `Get-Content -Raw` + `Set-Content`** — it reads the
  system ANSI codepage, corrupting every non-ASCII character and adding a BOM. (Also: `Get-Content`
  *display* of a UTF-8 file looks like mojibake even when the bytes are fine — check code points, not the
  console.)

## Deviations from the Original Kit
- **Next.js 16 / React 19 / Mongoose 9** instead of 15 / 19 / 8 — the scaffold and current registry
  versions. No API used by this project differs. Documented in `architecture.md`.
- **Style guide path** `/styleguide` instead of `/_styleguide` (private-folder routing rule).

## Branch Layout
- `feat/01-bootstrap-design-system` — Unit 01 + context sync.
- `feat/02-database-models` — Units 02 **and 03** (Unit 03's commit landed here before the branch was
  switched; both units are complete and verified, so history was left intact rather than rewritten).
- `feat/04-auth-ui` — Unit 04.
- `feat/05-app-shell` — Units 05, 06, 07, **08** and **09** (all on the same branch).
  - Unit 08 also fixes two Unit 02/05 defects that only became reachable now: the `isbn` /
    `membershipId` sparse-index default, and the `proxy.ts` login redirect.
  - Unit 09 adds `app/(public)/` (catalog + detail) alongside the app shell. The two
    coexist: `(public)` renders no `AppShell`, so a visitor never sees staff or member
    navigation.
- `feat/10-members-team` — Unit 10.
- `feat/11-circulation` — Unit 11.
- `feat/12-circulation-ui` — Unit 12.
- `feat/13-fines` — Unit 13.
- `feat/14-reservations` — Unit 14.

## First Admin Account
Unit 07 needed a librarian to verify with, and the register endpoint only ever creates a member by design,
so an admin was inserted directly into MongoDB: **`admin@gmail.com`** (role `admin`, bcrypt cost 10
matching `lib/auth/password.ts`, and no `membershipId`, since that field's sparse unique index rejects a
stored `null`). The bootstrap script lives in the QA folder outside the repo, so the credential is not
committed. Sign in with it to reach `/staff/*`; a member is silently redirected to `/dashboard` by
`proxy.ts` rather than shown an error, which looks like a missing page.

## Session Notes
- Start every session by reading `CLAUDE.md`, then all files it lists, then the current unit spec.
- **`.next` must be deleted before each dev-server start** (`rmdir /s /q .next`). OneDrive sync turns the
  Turbopack cache into a ~150MB tree and the dev server then takes minutes to become ready or refuses with
  "Another next dev server is already running". A stale `next dev` from a killed session keeps a file handle
  and makes the delete fail — find it with
  `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` and stop the ones whose `CommandLine` matches
  `*next*`.
- **Check port 3000 *before* deleting `.next` or starting a server, every time.** If something is
  already listening and healthy, **run the QA pass against it** — `run-unit14-existing.ps1` does exactly
  this. Two `next dev` processes in one project fight over the Turbopack cache, and a second `.next` build
  breaks the first server's pages in ways that read as routing bugs.
- **Never delete `.next` while a dev server is already running** — including the developer's own, outside this
  session. The process keeps the port but stops answering, so the browser shows the **404 page** on every
  route while `curl` reports a refused connection and Windows still lists port 3000 as `Listen`. That
  combination looks exactly like a routing bug and is not one. The QA scripts now abort with exit code 2 in
  that case.
- **A 404 page's text appears in *every* page's HTML**, because `not-found.tsx` ships in the shared client
  payload. Asserting `"This shelf is empty" in html` is therefore not a 404 test — assert on the route's own
  markers (`name="email"`, `<h1>Welcome back</h1>`) instead.
- **QA runs must not assume a clean database.** A row left over from an earlier run turns a POST into a
  409, which correctly keeps the dialog open and reads exactly like a hung save. Generate a unique name per
  run (`QA ${Date.now().toString(36)}`) and delete it afterwards. Two of the "hangs" chased during the
  dialog fix were this, not the app.
- **A browser pass needs a real mouse, and real settle time.** Radix swallows `Escape` during the open
  animation, so wait ~900ms after opening a dialog before keying it; and `ElementHandle.click()` /
  `page.mouse.click()` dispatch genuine pointer events, unlike `el.click()` inside `page.evaluate`. Use the
  real ones or the harness will both miss real bugs and invent them.
- **Local MongoDB is running and `MONGODB_URI` points at it**, so units can be verified against a real
  database rather than request interception. For the browser pass, create the accounts and fixtures
  directly in Mongo (bcrypt cost 10, matching `lib/auth/password.ts`; **omit `membershipId`** on staff —
  the sparse unique index rejects a stored `null`). There is no public path to a staff account: register
  only ever makes a member, and `POST /api/team` does not arrive until Unit 10.
- **Fixtures must be deterministic across runs** — see the two notes above.
- **A background dev server dies between tool calls.** Run the server start **and** the browser check inside a
  single command, otherwise the probe hits `ERR_CONNECTION_REFUSED`. `run-unit08.ps1` in the QA folder is the
  working pattern: clean `.next` → seed fixtures → start server → poll `/api/health` → API pass → browser
  pass → audit read → stop server.
- Browser QA harness lives in `%LOCALAPPDATA%\Temp\opencode\qa` (puppeteer-core + the installed Chrome) so
  no QA dependency is added to the project.
- **Read the screenshots.** Every assertion passed on the Unit 07 pass that first revealed the truncated card
  names and the mojibake, and again on the Unit 14 pass that revealed a register truncating itself at 50 rows,
  a book column starved to "No longer in the…", and a clipped actions menu. Assert on what a user would
  notice — text clipping, encoding, contrast, an unreachable control — not only on presence and count.
- **A `line-clamp` element reports its own truncation:** `scrollWidth > clientWidth`. Measure it rather than
  eyeballing a screenshot, and assert the same way.
- **Assert on the destination, never on a substring of the URL.** `url.includes("/login")` passes for
  `/login%3Fnext%3D…`, which is a 404. That is how a completely broken redirect survived a whole unit.
- **A page that renders a confident empty state is the most expensive kind of bug.** "No books yet ·
  0 books" over a catalog of 32 looked exactly like a correct empty list. Assert that the request fired
  and that rows exist, not that the empty state renders nicely.
- **When a check fails, dump what the user would have seen** — URL, `h1`, first 600 characters of body
  text, a screenshot, and the *named* step that was running. A bare `TimeoutError: waiting for selector`
  costs a whole debugging cycle.
- **Assert a field's content after typing it.** Character loss in a controlled/debounced input is
  invisible to every check that only asserts on the resulting URL.
- **Report partial results on a crash.** A harness that prints only on success loses the 39 checks that
  already told you which block was reached.
- **Isolate cookie jars.** Tabs in one Puppeteer browser share cookies, so an "anonymous" tab opened
  after signing in is still authenticated and the anonymous assertions silently test a signed-in user.
  Use `browser.createBrowserContext()`.
- **Auto-accept native `beforeunload` dialogs in automation.** An unanswerable native prompt blocks
  `page.goto` until it times out and the run dies with an unrelated-looking navigation error.
- **Wait for hydration before clicking.** The server-rendered form exists before React attaches; a click
  in that window is a plain native submit with no fetch and no session cookie. Wait for a
  client-only affordance, then assert you are actually signed in.
- The React Compiler rules **are** live in this project: `react-hooks/static-components` rejects a component
  resolved into a JSX tag during render, `react-hooks/refs` rejects reading a ref during render,
  `react-hooks/immutability` rejects mutating a hook argument (rename a ref to `*Ref` to make it legal),
  and `react-hooks/exhaustive-deps` requires the callback an effect calls. Build against them, not around them.
- `useReducedMotion()` returns `null` on the server but resolves on the **first client frame**, so it must
  be gated by `useIsHydrated()` or the animated markup will not match.

