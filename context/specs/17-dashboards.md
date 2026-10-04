# Unit 17: Dashboards

## Goal
Meaningful, real-data dashboards for members and staff with KPI cards and charts.

## Design
**Member `/dashboard`:** serif greeting ("Good evening, Sara") with date; row of 3 stat cards (Active loans, Ready holds, Outstanding fines); "Currently reading" horizontal scroller of loan cards with countdown rings; "Ready for pickup" banner if holds ready; "Recommended for you" (BookCards from categories of past loans, excluding borrowed, fallback to popular); "Your wishlist" preview row. **Staff `/staff`:** KPI grid (Total titles, Total copies, Members, Active loans, Overdue, Ready holds, Unpaid fines) with count-up and small icon tiles; charts in cards using recharts with token colors: Loans per day (area/line, 30 days), Loans by category (donut with legend), Top 5 borrowed books (horizontal bars); lists: Recent activity (from audit log, with icons and relative times), Low stock (books with ≤1 available copy), Due today. Charts animate on first view; tooltips styled with tokens.

## Implementation
- `lib/services/dashboard.ts`: `getMemberDashboard(userId)` and `getStaffDashboard()` using aggregation pipelines (`$group` by day with `$dateToString`, by category via `$lookup`, top books by `borrowCount` and recent 30-day loans). Zero-fill missing days in the series. Lazy maintenance trigger inside staff dashboard route (throttled).
- Routes: `GET /api/dashboard/member`, `GET /api/dashboard/staff`.
- Components: `KpiCard`, `LoansAreaChart`, `CategoryDonut`, `TopBooksBars`, `ActivityFeed`, `LowStockList`, `RecommendedRow`, `GreetingHeader`. Chart colors from category/primary tokens via CSS variables (read through `getComputedStyle` hook so dark mode updates).
- Skeletons for every card; empty states for charts with no data ("No loans yet").

## Dependencies
recharts.

## Verify when done
- [ ] All KPI numbers match direct database counts (spot-check three).
- [ ] 30-day series zero-fills days and totals equal the loans count in the range.
- [ ] Member dashboard shows only that member's data; recommendations exclude already-borrowed books.
- [ ] Charts readable and correctly colored in light and dark; tooltips work on touch.
- [ ] Layout adapts 360px → 1440px; no horizontal scroll.
- [ ] No TypeScript/console errors · `npm run build` passes.
