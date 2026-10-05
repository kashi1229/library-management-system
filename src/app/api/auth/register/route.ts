import "server-only";
import { AppError, handler, ok, parseBody } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/cookies";
import { signSession } from "@/lib/auth/jwt";
import { toPublicUser } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { User } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { nextMembershipId } from "@/lib/services/membership";
import { registerSchema } from "@/lib/validators/auth";
import type { PublicUser } from "@/types";

/**
 * POST /api/auth/register — public.
 *
 * Creates a **member** account only. There is deliberately no public path to
 * create staff: the first admin comes from the seed script (Unit 21), and
 * further librarians are created by an admin through `POST /api/team` (Unit 10).
 */
export const POST = handler(
  async (request) => {
    const input = await parseBody(registerSchema, request);

    const existing = await User.exists({ email: input.email });
    if (existing) {
      throw AppError.conflict("An account with this email already exists.", {
        email: "An account with this email already exists",
      });
    }

    // Membership IDs are generated from an atomic counter, so concurrent
    // registrations can never receive the same number.
    const membershipId = await nextMembershipId();

    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "member",
      membershipId,
      phone: input.phone ?? null,
      department: input.department ?? null,
      status: "active",
    });

    await logAudit({
      actor: { id: user._id, role: "member" },
      action: "user.create",
      entityType: "User",
      entityId: user._id,
      summary: `Member registered: ${user.email}`,
      meta: { membershipId },
    });

    const payload: PublicUser = toPublicUser(user);
    const token = await signSession({ sub: user._id.toString(), role: "member", name: user.name });

    const response = ok({ user: payload, redirectTo: ROLE_HOME.member }, undefined, 201);
    setSessionCookie(response, token);
    return response;
  },
  { name: "POST /api/auth/register" },
);
