## Application Building Context

Read the following files in order before implementing or making any architectural decision:

1. `context/project-overview.md` — product definition, roles, full feature catalog, and scope
2. `context/architecture.md` — system structure, boundaries, business rules, and invariants
3. `context/data-model.md` — every collection, field, index, and relation
4. `context/api-contract.md` — every API route, allowed roles, and payload shapes
5. `context/ui-context.md` — theme, colors, typography, motion, and layout conventions
6. `context/code-standards.md` — implementation rules and conventions
7. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
8. `context/progress-tracker.md` — current phase, completed work, open questions, and next steps

Then read the spec for the current unit in `context/specs/`.

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, data model, API, or standards documented in the context files,
update the relevant file before continuing.
