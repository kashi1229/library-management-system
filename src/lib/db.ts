import "server-only";
import mongoose, { type ClientSession } from "mongoose";

/**
 * Cached MongoDB connection.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * pool on every edit. The promise is parked on `globalThis` so a single
 * connection is reused for the lifetime of the process.
 */

declare global {
  var __mongooseCache: { connPromise: Promise<typeof mongoose> | null } | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI;

/** Fail loudly and early rather than surfacing an opaque driver error later. */
if (!MONGODB_URI) {
  // Not thrown at import time: `next build` imports modules without env access.
  // `connectDB()` throws instead, which is where it actually matters.
  console.warn("[db] MONGODB_URI is not set — database calls will fail.");
}

function cache(): { connPromise: Promise<typeof mongoose> | null } {
  globalThis.__mongooseCache ??= { connPromise: null };
  return globalThis.__mongooseCache;
}

/**
 * Connect once and reuse. Safe to call from every route handler — concurrent
 * callers share the same in-flight promise.
 */
export async function connectDB(): Promise<typeof mongoose> {
  const store = cache();

  if (store.connPromise) return store.connPromise;

  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not configured. Copy .env.example to .env.local and set a MongoDB Atlas connection string.",
    );
  }

  store.connPromise = mongoose.connect(MONGODB_URI, {
    // Transactions require a replica set; Atlas provides one on every tier.
    bufferCommands: false,
    serverSelectionTimeoutMS: 10_000,
  });

  try {
    return await store.connPromise;
  } catch (error) {
    // Clear the cache so the next attempt can retry instead of replaying a
    // permanently rejected promise.
    store.connPromise = null;
    throw error;
  }
}

/** Connection state without throwing — used by `/api/health`. */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/** Test/dev helper: drops the cached connection so the next call reconnects. */
export async function disconnectDB(): Promise<void> {
  cache().connPromise = null;
  await mongoose.disconnect();
}

type TransactionOptions = {
  readConcern?: { level: "snapshot" | "local" | "majority" };
  writeConcern?: { w: "majority" | 1 };
  readPreference?: "primary" | "primaryPreferred";
  maxCommitTimeMS?: number;
};

/**
 * Run `fn` inside a MongoDB transaction.
 *
 * `session.withTransaction` retries automatically on `TransientTransactionError`
 * and aborts on a thrown error, so every write in a circulation step either
 * lands together or not at all. Sessions are always closed.
 */
export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  await connectDB();

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;

    await session.withTransaction(async () => {
      result = await fn(session);
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      readPreference: "primary",
      ...options,
    });

    // `withTransaction` only resolves after commit, so `result` is always set.
    return result as T;
  } finally {
    await session.endSession();
  }
}

export { mongoose };
export type { ClientSession };
