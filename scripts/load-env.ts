/**
 * Load `.env.local` into `process.env` before anything else runs.
 *
 * **Import this first.** ESM evaluates imports in source order, so a module that
 * reads `process.env` at import time — `lib/db.ts` warns when `MONGODB_URI` is
 * missing — sees the value only if this module is listed above it. Setting the
 * variables inside `seed.ts` itself would be too late.
 *
 * Existing values win: an operator who exports `MONGODB_URI` in the shell to point
 * the seed at a different cluster gets what they asked for.
 */
import * as fs from "node:fs";
import * as path from "node:path";

function parse(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** The parsed file, for anything that needs a value without reading the file twice. */
export const env: Record<string, string> = parse(path.join(process.cwd(), ".env.local"));

for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}