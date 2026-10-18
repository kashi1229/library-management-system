import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { settingsApi } from "@/lib/api-client";

/**
 * How the API client serialises a mutation body.
 *
 * `send` already runs `JSON.stringify` on whatever `body` it is given, so a caller
 * that serialises first produces a **double-encoded** body. The server then reads a
 * JSON string where it expects an object: `PATCH /api/settings` answered 422
 * `Invalid input: expected object, received string` on every single save, and the
 * form could not show it because `_form` is not a field.
 *
 * `settingsApi.update` carried the extra `JSON.stringify` for exactly this long.
 * Nothing in `tsc` or `eslint` can see it — `body` is typed `unknown` — so the rule
 * is pinned here against the real `fetch` call instead.
 *
 * Run with `npm test`.
 */

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Capture the outgoing request and answer it with a success envelope. */
function captureFetch(): { calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ success: true, data: { libraryName: "Athenaeum" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  return { calls };
}

describe("api-client request bodies", () => {
  it("sends settings as a JSON object, not an encoded string", async () => {
    const { calls } = captureFetch();
    const payload = { libraryName: "Athenaeum", loanPeriodDays: 14, finePerDay: 5 };

    await settingsApi.update(payload);

    const body = calls[0].init.body as string;
    const parsed = JSON.parse(body);

    // The assertion the old code failed: `typeof parsed === "string"`.
    assert.equal(typeof parsed, "object");
    assert.deepEqual(parsed, payload);
    assert.ok(!body.startsWith('"'), "the body was double-encoded: it is a quoted JSON string");
  });

  it("keeps the JSON content type, which is the CSRF mitigation", async () => {
    const { calls } = captureFetch();

    await settingsApi.update({ libraryName: "Athenaeum" });

    assert.equal((calls[0].init.headers as Record<string, string>)["Content-Type"], "application/json");
  });

  it("sends no body — and no content type — on a read", async () => {
    const { calls } = captureFetch();

    await settingsApi.get();

    assert.equal(calls[0].init.body, undefined);
    assert.equal(calls[0].init.headers, undefined);
  });
});