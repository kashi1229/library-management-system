# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- Phase 0 — Planning complete. Build has not started.

## Current Goal
- Unit 01: Project bootstrap and design system foundation.

## Completed
- None yet.

## In Progress
- None yet.

## Next Up
- Unit 01 → see `context/specs/00-build-plan.md` for the full ordered list.

## Open Questions
- Final product name (default "Athenaeum").
- Default currency (default USD, editable in Settings).

## Architecture Decisions
- Next.js 15 App Router + Mongoose + Cloudinary signed uploads + jose JWT cookie sessions.
- Overdue is derived, never stored. Ready reservations hold a copy. Maintenance job is lazy/on-demand (no cron required).
- Business policy values live in the Settings singleton.

## Session Notes
- Context kit generated. Start every session by reading CLAUDE.md, then the current unit spec.
