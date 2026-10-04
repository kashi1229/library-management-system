# AI Workflow Rules

You are the implementation engine. The developer is the architect. Follow these rules exactly.

## Approach
- Development is **spec-driven and incremental**. Implement **one unit at a time** from `context/specs/`.
- Before writing code, read all files listed in `CLAUDE.md`, then the current unit spec, then `progress-tracker.md`.

## Scoping Rules
- Implement **only** what the current spec says. Do not add features, pages, packages, or refactors that are not in the spec.
- Do not make speculative changes "for later". Do not pre-install packages from future units.
- Do not mix system boundaries in one unit unless the spec says so (e.g. do not touch services while building a UI-only unit).
- Never edit files in `components/ui/` (shadcn-generated) unless the spec explicitly says to.
- Never change the context files' decisions silently. If implementation requires a change, stop, state the conflict, propose the update, and update the relevant context file **before** continuing.

## When to Split Work
- If a unit needs more than ~15 new files or touches more than two system boundaries, stop and propose a split before coding.
- If a step fails twice in a row for the same reason, stop, explain the root cause, and ask how to proceed. Do not loop.

## Missing or Ambiguous Requirements
- If something is undefined: **do not guess**. Check the context files, then the spec. If still undefined, ask one concise question and wait.
- If the spec contradicts a context file, the context file wins; report the contradiction.
- Never invent data fields, routes, roles, or business rules that are not documented.

## Quality Rules
- Follow `code-standards.md` and `ui-context.md` on every file.
- Every list/page/form must implement loading, empty, error, and success states.
- Every mutation must validate input (zod), check authorisation, and return the standard envelope.
- Use real data from the database; no hard-coded demo arrays in shipped UI (seed data is the only source of demo content).
- Keep functions small and named by intent. Add short comments only where logic is non-obvious (business rules, transactions).

## Documentation Sync
- After each meaningful change, update `context/progress-tracker.md` (Completed, In Progress, Next Up, Session Notes).
- If you add or change a collection, field, route, or token, update `data-model.md`, `api-contract.md`, or `ui-context.md` in the same unit.

## Verification Before Moving On
Before declaring a unit complete, confirm and report each item:
1. Every item in the spec's "Verify when done" checklist is satisfied (tick them in your report).
2. `npm run lint` passes. `npm run build` passes. No TypeScript errors.
3. No console errors or warnings in the browser for the flows touched.
4. Responsive check at 360px, 768px, and 1280px; light and dark themes.
5. Authorisation check: confirm forbidden roles are rejected on the new routes.
6. Progress tracker updated.
Then stop and wait for the developer's review. Do not start the next unit.

## Correction Behaviour
When told "X does not match the spec", fix **only X**. Do not touch anything else. Report the files changed.
