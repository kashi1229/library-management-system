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

/** Staff pages that only an admin may open (Unit 10, 18, 19). */
const ADMIN_ROUTES = ["/staff/team", "/staff/audit", "/staff/settings"] as const;

/** Everything under `/staff`, including the admin-only children above. */
const STAFF_PREFIX = "/staff";

const AUTH_ROUTES = ["/login", "/register"] as const;

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const session = await readSession(request);

  // 1. Signed-in users have no business on /login or /register.
  if (session && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return redirect(request, homeFor(session.role));
  }

  // 2. Staff area.
  if (pathname.startsWith(STAFF_PREFIX)) {
    if (!session) return redirect(request, `/login?next=${encodeURIComponent(pathname + search)}`);
    if (!isStaffRole(session.role)) return redirect(request, ROLE_HOME.member);
    if (session.role !== "admin" && ADMIN_ROUTES.some((route) => pathname.startsWith(route))) {
      return redirect(request, STAFF_PREFIX);
    }
    return NextResponse.next();
  }

  // 3. Member area.
  const isMemberRoute = MEMBER_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  if (isMemberRoute && !session) {
    return redirect(request, `/login?next=${encodeURIComponent(pathname + search)}`);
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

function redirect(request: NextRequest, target: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = "";
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
