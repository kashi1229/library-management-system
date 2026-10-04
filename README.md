# Library Management System — AI-Driven Build Kit

A spec-driven context kit for building a **final year university project**: a full-stack Library Management System
with **Next.js, MongoDB, Cloudinary, Lucide React icons**, and a minimal, artistic, animated, responsive UI.

This kit contains **no application code**. It contains everything an AI coding agent
(Claude Code, Codex, Cursor, Copilot, Windsurf) needs to build the project unit by unit
with no drift: context files, a build plan, and 21 detailed spec files.

## What's inside

```
library-management-system/
├── README.md                     ← this guide
├── CLAUDE.md                     ← entry point (Claude Code)
├── AGENTS.md                     ← entry point (Codex / Copilot / Next.js)
├── context/
│   ├── project-overview.md       ← product, roles, full feature catalog, scope
│   ├── architecture.md           ← stack, boundaries, business rules, invariants
│   ├── data-model.md             ← every collection, field, index, relation
│   ├── api-contract.md           ← every API route, role, request/response shape
│   ├── code-standards.md         ← TypeScript / Next.js / API conventions
│   ├── ai-workflow-rules.md      ← how the agent must behave
│   ├── ui-context.md             ← design tokens, typography, motion, layouts
│   ├── progress-tracker.md       ← living state of the build
│   └── specs/
│       ├── 00-build-plan.md      ← ordered list of all 21 units
│       └── 01 … 21-*.md          ← one spec per unit
└── docs/
    └── project-report-outline.md ← chapter outline for your university report
```

## How to use it

1. Create your Next.js project folder and copy this kit's contents into the project root
   (`CLAUDE.md`, `AGENTS.md`, `context/`, `docs/`).
2. Open your coding agent in the project root. It reads `CLAUDE.md` / `AGENTS.md` automatically.
3. Build one unit at a time with the three-prompt workflow:

**Implement**
```
Read context/specs/NN-feature-name.md.
Update context/progress-tracker.md to mark this unit as in progress.
Implement it exactly as specified.
Do not go beyond the scope of this unit.
```

**Correct (only if something is off)**
```
The [specific element] does not match the spec.
Expected: [what the spec says].
Current: [what was built].
Fix only this. Do not change anything else.
```

**Close**
```
Implementation is complete and verified.
Mark unit NN complete in context/progress-tracker.md.
Commit on branch feat/NN-feature-name.
```

4. Never skip units and never reorder them. The order is designed so every unit builds on something that already exists.
5. Before each unit, you run its "Verify when done" checklist yourself.

## Environment variables you will need

`MONGODB_URI`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.
Free tiers of MongoDB Atlas (a replica set, needed for transactions) and Cloudinary are enough.
