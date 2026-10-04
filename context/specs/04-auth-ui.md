# Unit 04: Auth UI (Login & Register)

## Goal
Beautiful, animated, validated login and register pages wired to the auth API with proper loading, error, and redirect behaviour.

## Design
Two-panel layout ≥1024px: left form panel on `background`; right panel on `primary` (dark forest) with a large Fraunces quote ("A library is a quiet kind of magic."), the Logo, and an illustration of softly drifting book spines made from CSS shapes using category colors. Mobile: single column, compact logo on top, same form. Inputs 44px, labels above, show/hide password eye (`Eye`/`EyeOff`), icons inside inputs (`Mail`, `Lock`, `User`, `Phone`, `GraduationCap`). Page transition fade-up; fields stagger in. Submit button shows `Loader2` spinner.

## Implementation

### `/login`
- Fields: email, password, "Remember me" (visual only; session is 7d), link to register.
- On success toast "Welcome back, {first name}" and navigate to `next` param (validated as internal path) or role home.
- Errors: generic invalid credentials banner (shake animation), rate-limit message with remaining time.

### `/register`
- Fields: full name, email, phone (optional), department (select with common options + "Other" free text), password with **strength meter** (4 segments, label Weak/Fair/Good/Strong), confirm password.
- Live validation with zod via react-hook-form; field-level server errors mapped (e.g. email taken).
- On success: toast, redirect to `/dashboard` (placeholder until Unit 05).

### Shared
- `AuthLayout` component, `PasswordInput`, `PasswordStrength`.
- Metadata titles. Autofocus first field. Enter submits.

## Dependencies
react-hook-form, @hookform/resolvers.

## Verify when done
- [ ] Register → lands on `/dashboard` with working cookie; membership ID generated.
- [ ] Login with member and with seeded/manual staff account redirects to correct home.
- [ ] Validation messages show inline for every rule; server errors map to fields.
- [ ] `next` param only allows same-origin paths.
- [ ] Right panel hidden on mobile; layout intact at 360px.
- [ ] Password toggle, strength meter, keyboard flow, focus rings all work; reduced motion respected.
- [ ] Light and dark themes look correct.
- [ ] No TypeScript errors · No console errors · `npm run build` passes.
