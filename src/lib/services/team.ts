import "server-only";
import { Types } from "mongoose";
import { AppError } from "@/lib/api";
import { User } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { hashPassword } from "@/lib/auth/password";
import { STAFF_ROLES } from "@/lib/constants";
import {
  type CreateStaffMemberInput,
  type UpdateTeamMemberInput,
} from "@/lib/validators/members";
import type { Actor, PublicUser } from "@/types";

/**
 * Team service — admin-only management of staff accounts (F6).
 *
 * Three rules here are load-bearing for the library actually staying usable, and all are
 * enforced in the service rather than the route so no caller can skip them:
 *
 * 1. **You cannot modify yourself.** An admin who edits their own name is harmless;
 *    an admin who suspends themselves locks every administrator out of the team screen
 *    and nobody can restore them.
 * 2. **You cannot disable the last active admin.** Same failure, reached by accident
 *    rather than intent — demoting the other admin while your own session is stale.
 * 3. **Only an admin can create an admin.** Minting an administrator hands over the
 *    ability to change library settings and to disable other staff, so the check is not
 *    left to a single caller.
 */

const TEAM_FIELDS =
  "name email role membershipId phone department avatar status suspendedReason lastLoginAt createdAt";

export type TeamMember = PublicUser;

/** Serialise for the API boundary: string ids and ISO dates. */
function serialise(user: {
  _id: unknown;
  name: string;
  email: string;
  role: PublicUser["role"];
  membershipId?: string | null;
  phone?: string | null;
  department?: string | null;
  avatar?: { url: string; publicId: string } | null;
  status: "active" | "suspended";
  suspendedReason?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    membershipId: user.membershipId ?? null,
    phone: user.phone ?? null,
    department: user.department ?? null,
    avatar: user.avatar ?? null,
    status: user.status,
    suspendedReason: user.suspendedReason ?? null,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Every librarian and admin, admins first, then newest. */
export async function listTeam(): Promise<TeamMember[]> {
  const docs = await User.find({ role: { $in: [...STAFF_ROLES] } })
    .select(TEAM_FIELDS)
    // `role` ascending puts `admin` before `librarian` alphabetically, which is the
    // order an admin actually wants to read.
    .sort({ role: 1, createdAt: -1 })
    .lean();

  return (docs as unknown as Array<Parameters<typeof serialise>[0]>).map(serialise);
}

/**
 * Create a staff account — librarian or administrator (F1, F6).
 *
 * **`membershipId` is never set.** It is a `unique` + `sparse` index, so a stored
 * `null` counts as a value and every staff account after the first would collide on
 * `membershipId_1`. The field is simply absent — the rule from `data-model.md`, and
 * the reason the model carries no `default`.
 *
 * **Only an admin may create an admin**, checked here as well as by the route. Minting an
 * administrator is the one action on this screen that hands over the ability to change
 * library settings and to disable other staff, so the check does not rely on a single
 * caller remembering it. A non-admin actor gets the same answer whether they reached this
 * by the API or by a future internal caller.
 *
 * A duplicate email is a `CONFLICT` naming the `email` field, so the form can put the
 * message where the user is looking rather than in a banner.
 */
export async function createStaffMember(
  input: CreateStaffMemberInput,
  actor: Actor,
): Promise<TeamMember> {
  // The schema defaults this to `librarian`, but the default lives in the validator and
  // the service must not depend on a caller having gone through it.
  const role = input.role ?? "librarian";

  if (role === "admin" && actor.role !== "admin") {
    throw AppError.forbidden("Only an administrator can create another administrator.");
  }

  const email = input.email.toLowerCase();

  if (await User.exists({ email })) {
    throw AppError.conflict("A staff account already uses that email address.", {
      email: "That email is already in use",
    });
  }

  const created = await User.create({
    name: input.name,
    email,
    passwordHash: await hashPassword(input.password),
    role,
    // Omitted, never null — see the note above.
    phone: input.phone ?? null,
    status: "active",
  });

  await logAudit({
    actor,
    action: "team.create",
    entityType: "User",
    entityId: created._id,
    summary: `Created ${role} account for ${created.email}`,
    // Role only. The password is never logged, not even hashed or truncated.
    meta: { email: created.email, role: created.role },
  });

  return serialise(created);
}

/** Load a staff account or throw. A member id here is a client mistake. */
async function requireTeamMember(id: string) {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That staff account could not be found.");

  const user = await User.findOne({ _id: id, role: { $in: [...STAFF_ROLES] } });
  if (!user) throw AppError.notFound("That staff account could not be found.");
  return user;
}

/** How many admins can still sign in. */
async function activeAdminCount(): Promise<number> {
  return User.countDocuments({ role: "admin", status: "active" });
}

/**
 * Update a librarian's name or status.
 *
 * **Role is not editable.** Promoting an existing librarian to admin from this screen
 * would be a privilege escalation with nothing recording who approved it, and a demotion
 * would silently strip someone's access mid-session. The schema does not accept `role` at
 * all, so the field is not merely ignored — it is rejected.
 *
 * The supported way to gain an administrator is `createStaffMember`, which writes an
 * audit entry naming the actor who authorised it.
 */
export async function updateTeamMember(
  id: string,
  input: UpdateTeamMemberInput,
  actor: Actor,
): Promise<TeamMember> {
  const user = await requireTeamMember(id);

  // Rule 1: no self-modification of status. Renaming yourself is harmless, so only the
  // status change is blocked.
  if (String(user._id) === String(actor.id)) {
    if (input.status !== undefined) {
      throw AppError.rule("You cannot change the status of your own account.");
    }
  }

  // Rule 2: never disable the last way in.
  if (input.status === "suspended" && user.role === "admin" && user.status === "active") {
    const admins = await activeAdminCount();
    if (admins <= 1) {
      throw AppError.rule(
        "This is the only active administrator. Add another administrator before disabling this account.",
      );
    }
  }

  const before = { name: user.name, status: user.status };

  if (input.name !== undefined) user.name = input.name;
  if (input.status !== undefined) {
    user.status = input.status;
    // Cleared with the status, for the same reason as on a member: a stale reason in an
    // active account's record is worse than no reason at all.
    user.suspendedReason = null;
  }

  await user.save();

  await logAudit({
    actor,
    action: "team.update",
    entityType: "User",
    entityId: user._id,
    summary: `Updated staff account ${user.email}`,
    meta: { before, after: { name: user.name, status: user.status }, role: user.role },
  });

  return serialise(user);
}