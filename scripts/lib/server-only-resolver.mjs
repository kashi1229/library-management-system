/**
 * Resolves the bare specifier `server-only` to an empty module, for ESM resolution.
 *
 * The full rationale — and why the CommonJS path needs a separate `Module._resolveFilename`
 * patch — lives in `../register-server-only.mjs`.
 */
const STUB = new URL("./server-only-stub.cjs", import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: STUB, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}