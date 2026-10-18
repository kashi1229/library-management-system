/**
 * Lets a plain Node process import modules marked `import "server-only"`.
 *
 * **Why this exists.** Every service, the models and `lib/db.ts` open with `import
 * "server-only"`, whose published entry point *throws* unless the `react-server` export
 * condition is set. Next.js sets it; Node does not. Without a shim, `npm run seed` could not
 * import `lib/services/circulation.ts` — and Unit 21's whole point is that the seed generates
 * loans, fines and reservations **through the real services**, not by inserting documents that
 * happen to agree with the business rules.
 *
 * **It resolves exactly one specifier and nothing else.** The alternative, running Node with
 * `--conditions=react-server`, flips that condition for *every* dependency, including ones
 * that change behaviour under it. Rewriting `server-only` to an empty module is the surgical
 * version: the guard exists to stop a Client Component from reaching server code, and a
 * command-line script is not a Client Component.
 *
 * **Both loaders are registered, because there are two module systems.** `tsx` compiles this
 * project's TypeScript to CommonJS, so `import "server-only"` arrives as a `require()` and is
 * caught by the `Module._resolveFilename` patch; the ESM `resolve` hook covers anything that
 * reaches Node through a dynamic `import()` instead.
 *
 * Usage: `node --import ./scripts/register-server-only.mjs --import tsx scripts/seed.ts`
 */
import Module, { register } from "node:module";
import { fileURLToPath } from "node:url";

const STUB_URL = new URL("./lib/server-only-stub.cjs", import.meta.url);
/* `Module._resolveFilename` wants a filesystem path; the ESM `resolve` hook wants a URL. */
const STUB_PATH = fileURLToPath(STUB_URL);

/* ------------------------------- CommonJS ------------------------------- */

const originalResolve = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, ...rest) {
  if (request === "server-only") {
    return STUB_PATH;
  }
  return originalResolve.call(this, request, ...rest);
};

/* ---------------------------------- ESM ---------------------------------- */

register("./lib/server-only-resolver.mjs", import.meta.url);