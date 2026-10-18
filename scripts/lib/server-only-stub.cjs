/**
 * The module `server-only` resolves to inside a Node script. Empty by design.
 *
 * A `.cjs` stub rather than `.mjs`: the seed script runs through `tsx`, which compiles the
 * project's TypeScript to CommonJS (there is no `"type": "module"` in `package.json`), so
 * `import "server-only"` reaches Node as a `require()` and must resolve to something `require`
 * can load.
 */
module.exports = {};