import { handler, ok } from "@/lib/api";
import { clearSessionCookie } from "@/lib/auth/cookies";
import { requireSession } from "@/lib/auth/session";

/** POST /api/auth/logout — member+. Clears the session cookie. */
export const POST = handler(
  async () => {
    // Verifying first means logging out with a bad token still clears the cookie,
    // so a client can always recover from a stale session.
    await requireSession().catch(() => null);

    const response = ok({ success: true });
    clearSessionCookie(response);
    return response;
  },
  { name: "POST /api/auth/logout" },
);
