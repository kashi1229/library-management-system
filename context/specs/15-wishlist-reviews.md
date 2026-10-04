# Unit 15: Wishlist & Reviews

## Goal
Members save books to a wishlist and rate/review books they have borrowed; ratings are aggregated on books.

## Design
Heart button on BookCard and detail page: animated spring pop and fill (`Heart` icon; filled uses `danger`-tinted accent), optimistic toggle. `/wishlist`: grid of BookCards with availability badge and quick **Reserve** where applicable, remove via heart, empty state "Your reading list is waiting." Detail page Reviews section: rating summary (large serif average, 5 distribution bars), list of reviews (avatar, name, stars, date, comment, "Edit/Delete" for own, "Remove" for staff), composer card (star picker with hover preview + textarea + submit) shown only to eligible members; ineligible members see a gentle hint "Borrow this book to leave a review."

## Implementation
- `lib/services/wishlist.ts`: `listWishlist`, `addToWishlist` (idempotent), `removeFromWishlist`. Routes per contract.
- `lib/services/reviews.ts`: `listReviews(bookId, page)`, `upsertReview(bookId, actor, {rating, comment})` (requires ≥1 loan of the book, any status; transaction recomputes `ratingAvg` (1 decimal) & `ratingCount` on book via aggregation), `deleteReview(id, actor)` (owner or staff; recompute). Routes per contract. Validators `lib/validators/review.ts`.
- `userState.wishlisted` now real in book detail/list; "Write a review" link in My Loans history opens the composer anchor.
- Staff review removal audited.

## Dependencies
None new.

## Verify when done
- [ ] Wishlist add/remove works from card, detail, and wishlist page; state consistent everywhere.
- [ ] Reviews: only members who borrowed can post; one per book (second post edits); rating average/count update correctly after create/edit/delete.
- [ ] Visitors see reviews but are prompted to sign in to interact.
- [ ] Staff can remove a review; members cannot remove others'.
- [ ] Star picker is keyboard accessible.
- [ ] Responsive; light/dark OK · No TypeScript/console errors · `npm run build` passes.
