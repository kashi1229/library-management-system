# Unit 02: Database Connection, Models & API Helpers

## Goal
Provide a cached MongoDB connection, every Mongoose model with indexes exactly as in `data-model.md`, the Settings singleton accessor, and the shared API helper layer (envelope, errors, handler wrapper). No endpoints with business behaviour yet except a health check.

## Design
No UI. Backend foundation only.

## Implementation

### Connection
- `lib/db.ts`: cached global connection (survives hot reload), reads `MONGODB_URI`, throws a clear error if missing. Exports `connectDB()` and `withTransaction(fn)` (starts session, retries on transient errors, aborts on throw).

### Models (`src/models/*`)
- One file per model: User, Counter, Category, Book, Loan, Fine, Reservation, Wishlist, Review, Notification, AuditLog, Setting. Fields, enums, defaults, validation, `timestamps`, text/compound/partial-unique indexes exactly per `data-model.md`.
- Re-use enums from `lib/constants.ts`.
- User model `toJSON` transform removes `passwordHash` and `__v`.
- Guard against model re-compilation in dev (`mongoose.models.X || model()`).

### Settings accessor
- `lib/services/settings.ts`: `getSettings()` (upserts defaults on first call, short in-memory cache 30s, invalidated on update), `updateSettings(patch, actor)` stub (completed in unit 19).

### API helpers
- `lib/api.ts`: `AppError` class (code, message, status, fields), `ok()`, `fail()`, `handler(fn, options)` wrapper (connectDB, try/catch, error → envelope, logs unknown errors), `parseBody(schema)`, `parseQuery(schema)`, `paginate()` helper returning `{skip, limit, page}` and `buildMeta()`.
- `lib/services/audit.ts`: `logAudit({actor, action, entityType, entityId, summary, meta})` (real implementation, used by later units).
- `lib/services/notifications.ts`: `notify(...)` as a **documented stub** (implemented in unit 16).
- `GET /api/health`: connects to DB and returns `{ status: 'ok', db: 'connected' }`.

### Counters
- `lib/services/membership.ts`: `nextMembershipId()` using atomic `findOneAndUpdate({_id:'membership-YYYY'},{$inc:{seq:1}},{upsert:true,new:true})` → `LIB-YYYY-0001`.

## Dependencies
mongoose (install only this here; bcryptjs and jose install in Unit 03).

## Verify when done
- [ ] `/api/health` returns connected status with a valid `MONGODB_URI`; clear error without it.
- [ ] All 12 models compile; indexes visible in Atlas after first run (`autoIndex` on in dev).
- [ ] `getSettings()` creates the singleton with defaults from `data-model.md`.
- [ ] `nextMembershipId()` returns sequential unique IDs under concurrent calls.
- [ ] `handler()` returns the standard envelope for success, AppError, and unexpected errors.
- [ ] No TypeScript errors · `npm run build` passes.
