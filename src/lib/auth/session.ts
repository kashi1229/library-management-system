import "server-only";
import { Types } from "mongoose";
import { AppError } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { isStaffRole, type Role } from "@/lib/constants";
import { getSessionToken } from "@/lib/auth/cookies";
import { verifySession, type SessionPayload } from "@/lib/auth/jwt";
import type { Actor, PublicUser } from "@/types";

/**
 * Server-side session and role guards.
 *
 * Invariant 2: every route handler calls one of these **before** touching data.
 * Invariant 3: ownership is always derived from the session, never from a
 * client-supplied user id.
 */

export type Session = SessionPayload;

/** The user record a guard returns — always fetched fresh, never from the token. */
export type AuthenticatedUser = {
  id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  membershipId: string | null;
  status: "active" | "suspended";
  avatar: PublicUser["avatar"];
};

export type AuthContext = {
  user: AuthenticatedUser;
  actor: Actor;
};

/** The safe projection used by every guard — `passwordHash` is never selected. */
const USER_FIELDS = "name email role membershipId status avatar";

/** Decode the cookie without hitting the database. Used by middleware and pages. */
export async function getSession(): Promise<Session | null> {
  return verifySession(await getSessionToken());
}

/**
 * Require a valid session **and** re-read the user from the database, so a
 * suspended user or a demoted staff member loses access immediately rather than
 * when their token happens to expire (architecture.md §Auth & Access Model).
 */
export async function requireSession(): Promise<AuthContext> {
  const session = await getSession();

  if (!session || !Types.ObjectId.isValid(session.sub)) {
    throw AppError.unauthenticated("You must be signed in to do that.");
  }

  await connectDB();

  const user = await User.findById(session.sub).select(USER_FIELDS).lean<{
    _id: Types.ObjectId;
    name: string;
    email: string;
    role: Role;
    membershipId: string | null;
    status: "active" | "suspended";
    avatar: PublicUser["avatar"];
  }>({ lean: true });

  // Token is valid but the account is gone: treat as signed out.
  if (!user) throw AppError.unauthenticated("Your session is no longer valid.");

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      membershipId: user.membershipId,
      status: user.status,
      avatar: user.avatar ?? null,
    },
    actor: { id: user._id, role: user.role },
  };
}

/**
 * Require a session whose **database** role is one of `roles`.
 * Always pair with `requireSession()` semantics — this call performs the same
 * fresh lookup, so `requireRole([...])` alone is enough.
 */
export async function requireRole(roles: readonly Role[]): Promise<AuthContext> {
  const context = await requireSession();

  if (!roles.includes(context.user.role)) {
    throw AppError.forbidden("You do not have access to this resource.");
  }

  return context;
}

/** Staff-only guard: librarian or admin. */
export function requireStaff(): Promise<AuthContext> {
  return requireRole(["librarian", "admin"]);
}

/** Admin-only guard. */
export function requireAdmin(): Promise<AuthContext> {
  return requireRole(["admin"]);
}

/**
 * Require an **active member** — the check circulation uses before issuing,
 * renewing or reserving (architecture.md §Auth & Access Model).
 *
 * Suspended users may still sign in and read, so this is only called from the
 * specific operations they are blocked from, never at the top of a route.
 */
export async function requireActiveMember(): Promise<AuthContext> {
  const context = await requireSession();

  if (context.user.status === "suspended") {
    throw AppError.rule(
      "Your account is suspended. Please contact the library desk to reactivate it.",
    );
  }

  return context;
}

/** Convenience for pages: resolve the current user or `null`, never throws. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    return (await requireSession()).user;
  } catch {
    return null;
  }
}

/** Shape a lean user document into the API's safe user payload. */
export function toPublicUser(user: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
  membershipId?: string | null;
  phone?: string | null;
  department?: string | null;
  avatar?: PublicUser["avatar"];
  status: "active" | "suspended";
  suspendedReason?: string | null;
  lastLoginAt?: Date | null;
  createdAt?: Date;
}): PublicUser {
  return {
    id: user._id.toString(),
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
    createdAt: (user.createdAt ?? new Date(0)).toISOString(),
  };
}

export { isStaffRole };
