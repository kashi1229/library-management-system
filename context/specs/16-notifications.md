# Unit 16: Notifications & Maintenance Job

## Goal
Real in-app notifications for all events, a bell with unread badge, a notifications page, and the idempotent maintenance job.

## Design
Bell (`Bell` icon) in topbar with animated count badge; click opens Popover (320px) with latest 6 items (icon by type, title, message, relative time via date-fns, unread dot) plus "Mark all read" and "View all". Bell does a subtle shake when the unread count increases (poll every 60s with SWR `refreshInterval`). `/notifications`: list with tabs All / Unread, grouped by day, type icon tiles colored by status (info/warning/danger/success), click marks read and navigates to `link`. Empty state "You're all caught up."

## Implementation
- `lib/services/notifications.ts`: replace the stub `notify({userId, type, title, message, link, dedupeKey?})` (swallow duplicate-key errors from `dedupeKey`), `listNotifications`, `markRead`, `markAllRead`, `getUnreadCount`.
- Template map `lib/notification-templates.ts` for every type in `data-model.md` (title/message/link builders). Wire calls into: issue, return, renew, fine created/paid/waived, reservation ready/expired/cancelled, suspend/activate, new reservation (to staff: optional, only for books with zero available — keep to one notification per reservation to all librarians).
- `lib/services/maintenance.ts`: `runMaintenance()` per architecture (expire reservations, due_soon, overdue notifications with dedupe keys); returns counts. `POST /api/maintenance/run` (admin session or `x-cron-secret`). Staff dashboard layout triggers a throttled lazy run (Settings `lastMaintenanceAt`, 10 min). Admin "Run maintenance" button added to Settings page in Unit 19 (note in tracker).
- Routes per contract.

## Dependencies
None new.

## Verify when done
- [ ] Each wired event creates exactly one notification for the right user.
- [ ] Unread badge updates within 60s; mark read/all read work; clicking navigates to link.
- [ ] Running maintenance twice on the same day creates no duplicate due-soon/overdue notifications.
- [ ] Maintenance expires stale ready reservations and promotes the queue.
- [ ] `x-cron-secret` header works; wrong secret returns 403; members cannot trigger it.
- [ ] Users only see their own notifications.
- [ ] Responsive popover/page; light/dark OK · No TypeScript/console errors · `npm run build` passes.
