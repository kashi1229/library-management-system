import { AppError, handler, ok, parseBody } from "@/lib/api";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { requireSession } from "@/lib/auth/session";
import { User } from "@/models";
import { changePasswordSchema } from "@/lib/validators/auth";

/**
 * PATCH /api/auth/password — member+.
 *
 * Requires the current password (F2). Audit logging is intentionally not used
 * here: a self-service password change is already visible via `updatedAt`, and
 * audit entries are reserved for staff actions on other accounts (invariant 11).
 */
export const PATCH = handler(
  async (request) => {
    const { user } = await requireSession();
    const input = await parseBody(changePasswordSchema, request);

    const record = await User.findById(user.id).select("+passwordHash");

    if (!record) {
      throw AppError.unauthenticated("Your account no longer exists.");
    }

    const matches = await verifyPassword(input.currentPassword, record.passwordHash);
    if (!matches) {
      throw AppError.validation("Your current password is incorrect.", {
        currentPassword: "Incorrect password",
      });
    }

    record.passwordHash = await hashPassword(input.newPassword);
    await record.save();

    // The session stays valid; the password itself is not part of the token.
    return ok({ changed: true });
  },
  { name: "PATCH /api/auth/password" },
);
