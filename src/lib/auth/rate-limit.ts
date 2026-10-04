/**
 * In-memory sliding-window rate limiter.
 *
 * Deliberately simple and per-process: the spec calls for 5 login attempts per
 * 10 minutes keyed by IP + email, which is enough to blunt credential stuffing
 * on a single-instance deployment. A multi-region deployment would move this
 * to a shared store, but the call signature would not change.
 */

type Bucket = { hits: number[] };

export type RateLimitOptions = {
  /** Identifies the caller, e.g. `"203.0.113.7:reader@example.com"`. */
  key: string;
  /** Maximum hits allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the caller may retry. 0 when allowed. */
  retryAfterSeconds: number;
};

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map cannot grow without bound. */
function sweep(now: number): void {
  if (buckets.size < 5_000) return;

  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] > 3_600_000) {
      buckets.delete(key);
    }
  }
}

/**
 * Record a hit and report whether the caller is still within budget.
 * The window slides: only hits inside the last `windowMs` count.
 */
export function consume(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(options.key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((hit) => now - hit < options.windowMs);

  if (bucket.hits.length >= options.limit) {
    const oldest = bucket.hits[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));

    buckets.set(options.key, bucket);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  bucket.hits.push(now);
  buckets.set(options.key, bucket);

  return { ok: true, remaining: options.limit - bucket.hits.length, retryAfterSeconds: 0 };
}

/** Forget a key — called after a successful login so good users are not penalised. */
export function reset(key: string): void {
  buckets.delete(key);
}

/** Test helper: clear all buckets. */
export function clearAll(): void {
  buckets.clear();
}

export const LOGIN_RATE_LIMIT = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
} as const;
