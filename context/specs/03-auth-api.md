# Unit 03: Auth API & Route Protection

## Goal
Secure authentication: register members, login, logout, current user, change password; JWT httpOnly cookie sessions; middleware route gating; server-side role guards reusable by every later route.

## Design
No UI (UI is Unit 04). Provide a bare protected test page only if needed for verification, then remove it.

## Implementation

### Validators (`lib/validators/auth.ts`)
- `registerSchema`: name (2–80), email (valid, lowercased), password (≥8, ≥1 letter, ≥1 number), confirmPassword (match), phone (optional, 7–15 digits/+), department (optional).
- `loginSchema`: email, password. `changePasswordSchema`: currentPassword, newPassword (rules as above).

### Auth library (`lib/auth/*`)
- `jwt.ts`: `signSession({sub, role, name})` and `verifySession(token)` using `jose`, HS256, 7d.
- `cookies.ts`: set/clear `athenaeum_session` (httpOnly, sameSite lax, secure in production, path `/`, maxAge 7d).
- `session.ts`: `getSession()` (reads cookie; returns payload or null), `requireSession()` (loads user from DB, verifies exists, throws UNAUTHENTICATED), `requireRole(roles)` (throws FORBIDDEN), `requireActiveMember()` helper used later for suspended checks.
- `rate-limit.ts`: simple in-memory sliding window limiter keyed by IP+email for login (5 / 10 min) → RATE_LIMITED.

### Routes
- `POST /api/auth/register`: validate → ensure unique email (CONFLICT with field error) → hash (bcrypt cost 10) → create `member` with `membershipId` → set cookie → return user.
- `POST /api/auth/login`: rate-limit → find by email with `+passwordHash` → generic "Invalid email or password" on failure → update `lastLoginAt` → set cookie → return user + `redirectTo` (`/staff` for staff, `/dashboard` for member).
- `POST /api/auth/logout`: clear cookie.
- `GET /api/auth/me`: return safe user (id, name, email, role, membershipId, avatar, status).
- `PATCH /api/auth/password`: verify current → hash new → save → audit not required.

### Middleware (`src/middleware.ts`)
- Matcher covers `(member)` routes (`/dashboard, /my-loans, /reservations, /wishlist, /fines, /notifications, /profile`), `/staff/*`, `/login`, `/register`.
- Verifies JWT (jose works in edge). No/invalid token → `/login?next=<path>`. Role `member` on `/staff/*` → `/dashboard`. Authenticated on `/login|/register` → home by role.
- Admin-only staff routes (`/staff/team`, `/staff/audit`, `/staff/settings`): librarians → `/staff`.

### Bootstrap admin
- Document in README: first admin created via the seed script (Unit 21). No public path to create staff.

## Dependencies
jose, bcryptjs, @types/bcryptjs.

## Verify when done
- [ ] Register creates a member with unique `membershipId`; duplicate email returns field error 409.
- [ ] Login sets httpOnly cookie; wrong password is generic; 6th attempt in 10 min returns 429.
- [ ] `/api/auth/me` returns 401 without cookie, user with cookie, never includes `passwordHash`.
- [ ] Middleware redirects verified for: anonymous→/login, member→/staff, logged-in→/login, librarian→/staff/settings.
- [ ] Tampered/expired token is rejected.
- [ ] A suspended user's `requireActiveMember()` throws RULE_VIOLATION.
- [ ] No TypeScript errors · `npm run build` passes.
