import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/constants";

/**
 * Stateless session tokens.
 *
 * `jose` is used because it runs on the Edge runtime, so the same code verifies
 * tokens in `middleware.ts` and in Node route handlers.
 */

export const SESSION_COOKIE_NAME = "athenaeum_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** The payload shape stored in the cookie. Deliberately minimal. */
export type SessionPayload = {
  /** User id. */
  sub: string;
  role: Role;
  name: string;
};

function secret(): Uint8Array {
  const value = process.env.JWT_SECRET;

  if (!value) {
    throw new Error(
      "JWT_SECRET is not configured. Copy .env.example to .env.local and set a long random string.",
    );
  }

  return new TextEncoder().encode(value);
}

/** Sign a 7-day HS256 token. */
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/**
 * Verify and decode a token.
 *
 * Returns `null` for anything invalid — expired, tampered, wrong signature,
 * wrong algorithm, or missing secret — so callers never need to distinguish
 * between failure modes.
 */
export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });

    if (!payload.sub || typeof payload.role !== "string" || typeof payload.name !== "string") {
      return null;
    }

    return {
      sub: payload.sub,
      role: payload.role as Role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}
