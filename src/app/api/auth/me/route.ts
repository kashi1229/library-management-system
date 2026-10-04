import { AppError, handler, ok } from "@/lib/api";
import { requireSession, toPublicUser } from "@/lib/auth/session";
import { User } from "@/models";

/**
 * GET /api/auth/me — member+.
 *
 * Re-reads the user from the database so a suspension or role change takes
 * effect immediately. `passwordHash` is never selected.
 */
export const GET = handler(
  async () => {
    const { user } = await requireSession();

    const full = await User.findById(user.id)
      .select("name email role membershipId phone department avatar status suspendedReason lastLoginAt createdAt")
      .lean<Parameters<typeof toPublicUser>[0] & { createdAt: Date }>({ lean: true });

    if (!full) {
      // The account was deleted while the token was still valid.
      throw AppError.unauthenticated("Your account no longer exists.");
    }

    return ok({ user: toPublicUser(full) });
  },
  { name: "GET /api/auth/me" },
);
