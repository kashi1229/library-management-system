import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/jwt";

/**
 * Session cookie helpers.
 *
 * The token lives in an httpOnly, SameSite=Lax cookie so it is never reachable
 * from client JavaScript (XSS cannot read it) and is not sent on cross-site
 * form posts (CSRF mitigation, `code-standards.md` §Security).
 */

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;

/** Attach the session cookie to a response. */
export function setSessionCookie(response: Response, token: string): void {
  response.headers.append(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS),
  );
}

/** Remove the session cookie. */
export function clearSessionCookie(response: Response): void {
  response.headers.append(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 }),
  );
}

/** Read the raw token from the request cookie header. */
export function readSessionTokenFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) return decodeURIComponent(rest.join("="));
  }

  return null;
}

/**
 * Read the current token inside a Server Component or Route Handler.
 * Returns `null` when there is no session.
 */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Minimal, dependency-free cookie serialiser.
 *
 * `cookies().set()` only works inside a Server Action or Route Handler, and
 * appending the header directly works everywhere the response object exists —
 * which keeps `setSessionCookie` usable from both.
 */
function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    sameSite: "lax" | "strict" | "none";
    secure: boolean;
    path: string;
    maxAge: number;
  },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`];

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite.charAt(0).toUpperCase()}${options.sameSite.slice(1)}`);

  return parts.join("; ");
}
