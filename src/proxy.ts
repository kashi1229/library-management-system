import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from "@/lib/auth/jwt";
import { ROLE_HOME, isStaffRole, type Role } from "@/lib/constants";

/**
 * Coarse route protection (architecture.md §Auth & Access Model).
 *
 * This is **only** the first gate — it redirects before a page renders so the
 * user never sees a flash of protected UI. The real enforcement is server-side:
 * every route handler calls `requireSession()` / `requireRole()` and re-reads
 * the user from the database. Never treat a pass here as authorisation.
 *
 * Named `proxy.ts` rather than `middleware.ts`: Next.js 16 renamed the file
 * convention (the old name still works but logs a deprecation warning), and the
 * exported function follows the new `proxy` name.
 */

/** Member-area pages that require any signed-in user. */
const MEMBER_ROUTES = [
  "/dashboard",
  "/my-loans",
  "/reservations",
  "/wishlist",
  "/fines",
  "/notifications",
  "/profile",
] as const;

/** Staff pages that only an admin may open (Units 10, 18, 19). */
const ADMIN_ROUTES = ["/staff/team", "/staff/audit", "/staff/settings"] as const;

/** Everything under `/staff`, including the admin-only children above. */
const STAFF_PREFIX = "/staff";

const AUTH_ROUTES = ["/login", "/register"] as const;

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const session = await readSession(request);

  // 1. Signed-in users have no business on /login or /register.
  if (session && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return redirect(request, homeFor(session.role));
  }

  // 2. Staff area.
  if (pathname.startsWith(STAFF_PREFIX)) {
    if (!session) return redirectToLogin(request);
    if (!isStaffRole(session.role)) return redirect(request, ROLE_HOME.member);
    if (session.role !== "admin" && ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
      return redirect(request, STAFF_PREFIX);
    }
    return NextResponse.next();
  }

  // 3. Member area.
  const isMemberRoute = MEMBER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isMemberRoute && !session) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

/** Verify the cookie with the same `jose` helper the server uses (edge-safe). */
async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

function homeFor(role: Role): string {
  return ROLE_HOME[role] ?? ROLE_HOME.member;
}

/**
 * Send an anonymous visitor to the sign-in page, remembering where they were.
 *
 * Built with `searchParams.set` rather than by assigning a query string to
 * `pathname`. **That was a real bug**: `url.pathname = "/login?next=/staff/books"`
 * percent-encodes the `?`, so the browser was sent to the literal path
 * `/login%3Fnext%3D%2Fstaff%2Fbooks` and got the **404 page**. Every
 * unauthenticated visit to a protected route was broken, and it survived the Unit
 * 05 pass because the assertion was `url.includes("/login")`, which the mangled
 * URL still satisfies — the test confirmed the string, not the destination.
 *
 * `searchParams.set` encodes the *value* only, which is what is wanted here: the
 * `next` value is a path that may itself contain `?` and `&`.
 */
function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

/**
 * Redirect to a same-app path.
 *
 * The target is split on `?` rather than assigned whole: `pathname` is a *path*,
 * so anything after a `?` in it is percent-encoded and stops being a query. Plain
 * path targets (every `ROLE_HOME`, every admin guard) have no query, but the split
 * keeps this helper honest if one is ever added.
 */
function redirect(request: NextRequest, target: string): NextResponse {
  const url = request.nextUrl.clone();
  const separator = target.indexOf("?");
  url.pathname = separator === -1 ? target : target.slice(0, separator);
  url.search = separator === -1 ? "" : target.slice(separator);
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Run on the protected areas plus the two auth pages. Static assets and the
   * API routes are excluded: APIs guard themselves with `requireRole()`.
   */
  matcher: [
    "/login",
    "/register",
    "/dashboard/:path*",
    "/my-loans/:path*",
    "/reservations/:path*",
    "/wishlist/:path*",
    "/fines/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/staff/:path*",
  ],
};
