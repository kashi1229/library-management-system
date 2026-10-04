import { AppError, handler, ok, parseBody } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/cookies";
import { signSession } from "@/lib/auth/jwt";
import { toPublicUser } from "@/lib/auth/session";
import { consume, reset, LOGIN_RATE_LIMIT } from "@/lib/auth/rate-limit";
import { ROLE_HOME, isStaffRole } from "@/lib/constants";
import { User } from "@/models";
import { loginSchema } from "@/lib/validators/auth";
import type { PublicUser } from "@/types";

/**
 * POST /api/auth/login â€” public, rate-limited to 5 attempts / 10 min per IP+email.
 *
 * Failure is deliberately indistinguishable between "no such email" and "wrong
 * password" so the endpoint cannot be used to enumerate accounts.
 */
export const POST = handler(
  async (request) => {
    const input = await parseBody(loginSchema, request);

    const ip = clientIp(request.headers.get("x-forwarded-for"));
    const key = `${ip}:${input.email}`;

    const limit = consume({ key, ...LOGIN_RATE_LIMIT });
    if (!limit.ok) {
      throw new AppError(
        "RATE_LIMITED",
        `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
      );
    }

    // `passwordHash` is `select: false`, so it must be asked for explicitly.
    const user = await User.findOne({ email: input.email }).select("+passwordHash");

    const passwordMatches = user ? await verifyPassword(input.password, user.passwordHash) : false;

    if (!user || !passwordMatches) {
      throw AppError.unauthenticated("Invalid email or password.");
    }

    // A good password must not leave the user rate-limited.
    reset(key);

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    const payload: PublicUser = toPublicUser(user);
    const token = await signSession({
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
    });

    const redirectTo = isStaffRole(user.role) ? ROLE_HOME[user.role] : ROLE_HOME.member;
    const response = ok({ user: payload, redirectTo });
    setSessionCookie(response, token);
    return response;
  },
  { name: "POST /api/auth/login" },
);

/**
 * Best-effort client IP. Trusts `x-forwarded-for` (set by Vercel and every
 * reverse proxy) and falls back to a constant so the limiter still works in
 * local development where no proxy sets the header.
 */
function clientIp(forwardedFor: string | null): string {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "local";
}
