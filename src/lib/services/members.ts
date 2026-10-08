import "server-only";
import { Types } from "mongoose";
import { AppError } from "@/lib/api";
import { Fine, Loan, Reservation, User } from "@/models";
import { logAudit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notifications";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import {
  ACTIVE_RESERVATION_STATUSES,
  MEMBER_HISTORY_LIMIT,
  type FineStatus,
  type LoanStatus,
  type ReservationStatus,
  type Role,
} from "@/lib/constants";
import { deriveLoanState } from "@/lib/services/circulation";
import { bookRefOr as refFor, bookRefs } from "@/lib/services/refs";

/** Where the notification sends the member when their account status changes. */
const PROFILE_LINK = "/profile";
import type {
  Actor,
  MemberRecord,
  PublicUser,
} from "@/types";

/**
 * Member service — all business logic for F6.
 *
 * Every mutation is audited (invariant 11) and takes its actor as `{ id, role }`, never
 * a client-supplied id (invariant 3).
 */

/* -------------------------------------------------------------------------- */
/* Shapes                                                                     */
/* -------------------------------------------------------------------------- */

/** A member row: the user plus the one count the table shows. */
export type MemberListItem = PublicUser & {
  /** Loans currently out. Counts, rather than fetching every loan to learn a length. */
  activeLoans: number;
};

/**
 * The member record. An alias, not a second declaration.
 *
 * `MemberRecord` lives in `types/index.ts` because it is a **wire** shape that both this
 * service and `lib/api-client` must agree on; declaring it in both places is how the
 * Unit 08 book payload drifted into a type error with no visible cause.
 */
export type MemberDetail = MemberRecord;

const MEMBER_FIELDS =
  "name email role membershipId phone department avatar status suspendedReason lastLoginAt createdAt";

/** Escape a user string before interpolating it into a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Serialise a lean user for the API boundary.
 *
 * Declared locally rather than reusing `toPublicUser` from `lib/auth/session`, because
 * that module is `server-only` and this service also is — but the *shape* is the one
 * contract. Both convert ids to strings and dates to ISO, so the wire format and
 * `PublicUser` agree by construction instead of by `JSON.stringify` coercing an
 * `ObjectId` for us.
 */
function toPublicUserish(user: {
  _id: unknown;
  name: string;
  email: string;
  role: Role;
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

function toMember(doc: Record<string, unknown>, activeLoans: number): MemberListItem {
  return { ...toPublicUserish(doc as unknown as Parameters<typeof toPublicUserish>[0]), activeLoans };
}

/* -------------------------------------------------------------------------- */
/* Counts                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Active-loan counts for a page of members, in one aggregation.
 *
 * `countDocuments` per row would be N queries for one table; a `$group` over the
 * page's ids is one. The result map is keyed by string so the caller never has to think
 * about `ObjectId` equality.
 */
async function activeLoanCounts(memberIds: Types.ObjectId[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (memberIds.length === 0) return counts;

  const rows = await Loan.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { member: { $in: memberIds }, status: "active" } },
    { $group: { _id: "$member", count: { $sum: 1 } } },
  ]);

  for (const row of rows) counts.set(row._id.toString(), row.count);
  return counts;
}

/* -------------------------------------------------------------------------- */
/* History helpers                                                             */
/* -------------------------------------------------------------------------- */

/*
 * `deriveLoanState`, `bookRefs` and `bookRefOr` used to live in this file and now come
 * from `services/circulation.ts`. Loans *are* circulation: the loan-state rule and the
 * "a book shown next to a loan" shape have one owner, so the member record and the
 * circulation desk cannot drift apart.
 *
 * The rule also changed with the move, deliberately. It now counts **calendar** days
 * (date-fns `differenceInCalendarDays`, invariant 12) rather than whole 24-hour blocks,
 * because the fine is charged from that number and a book that crossed midnight should
 * cost one day, not zero.
 */

/**
 * 1-based FIFO position for each of this member's waiting holds, in two queries total.
 *
 * The alternative is one count query per hold, which is N round trips for a list that
 * is usually one or two rows long. Instead the whole queue for the handful of books
 * involved is fetched once in FIFO order and the position is counted off it.
 *
 * Sorted `createdAt: 1, _id: 1` to match the `Reservation` FIFO index, with `_id` as
 * the tiebreaker — without it, two holds created in the same millisecond have no
 * defined order and the same hold could report a different position on each load.
 */
async function queuePositions(
  bookIds: unknown[],
  memberId: Types.ObjectId,
): Promise<Map<string, number>> {
  const positions = new Map<string, number>();

  const unique = [...new Set(bookIds.map(String))].filter((id) => Types.ObjectId.isValid(id));
  if (unique.length === 0) return positions;

  const queue = await Reservation.find({
    book: { $in: unique.map((id) => new Types.ObjectId(id)) },
    status: { $in: [...ACTIVE_RESERVATION_STATUSES] },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("book member")
    .lean<Array<Record<string, unknown>>>();

  const seen = new Map<string, number>();

  for (const entry of queue) {
    const bookKey = String(entry.book);
    const place = (seen.get(bookKey) ?? 0) + 1;
    seen.set(bookKey, place);

    if (String(entry.member) === memberId.toString()) {
      positions.set(String(entry._id), place);
    }
  }

  return positions;
}

/* -------------------------------------------------------------------------- */
/* Read                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * List members, paginated.
 *
 * Always `role: "member"`: the members screen is not the team screen, and mixing
 * them would put librarians in a list whose actions ("suspend") mean something
 * different for them.
 *
 * Search is a case-insensitive regex across name, email and membership ID. Regex
 * rather than `$text` because a librarian is typing a partial name and `$text` only
 * matches whole words; the input is length-capped and escaped.
 */
export async function listMembers(query: {
  q?: string;
  status?: "active" | "suspended";
  page?: number;
  limit?: number;
}): Promise<{
  items: MemberListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  const filter: Record<string, unknown> = { role: "member" };
  if (query.status) filter.status = query.status;

  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: rx }, { email: rx }, { membershipId: rx }];
  }

  const [total, docs] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select(MEMBER_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const rows = docs as unknown as Array<Record<string, unknown>>;
  const counts = await activeLoanCounts(rows.map((doc) => new Types.ObjectId(String(doc._id))));

  return {
    items: rows.map((doc) => toMember(doc, counts.get(String(doc._id)) ?? 0)),
    meta: { page, limit, total, totalPages: limit > 0 ? Math.ceil(total / limit) : 0 },
  };
}

/**
 * One member: identity, the header's counts, and their recent loans, fines and holds.
 *
 * Counts and rows are fetched together. The counts are exact over the whole collection;
 * the rows are capped at `MEMBER_HISTORY_LIMIT` and newest-first, so the UI has to say
 * "most recent N of M" rather than imply the list is everything. Returning both from one
 * call also means the header and the tabs can never disagree — they read the same object.
 *
 * The loan `view` (`on_time` / `due_soon` / `overdue`) is derived here rather than in the
 * component, and the queue positions are counted from one ordered read of the relevant
 * queues. Both are shared rules; neither belongs in a render.
 *
 * Throws `NOT_FOUND` for a non-member too: an admin asking for a librarian's record
 * through the members screen is a client mistake, and saying so plainly beats
 * returning a member-shaped object with blank fields.
 */
export async function getMemberDetail(id: string): Promise<MemberDetail> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That member could not be found.");

  const doc = await User.findOne({ _id: id, role: "member" })
    .select(MEMBER_FIELDS)
    .lean<Record<string, unknown>>();

  if (!doc) throw AppError.notFound("That member could not be found.");

  const memberId = new Types.ObjectId(id);
  const now = new Date();

  // Counts and rows together in one `Promise.all`. They are independent reads on
  // indexed fields, so they go out concurrently rather than in sequence.
  const [
    activeLoans,
    totalBorrowed,
    unpaidFines,
    activeReservations,
    fineAgg,
    loanDocs,
    fineDocs,
    reservationDocs,
  ] = await Promise.all([
    Loan.countDocuments({ member: memberId, status: "active" }),
    Loan.countDocuments({ member: memberId }),
    Fine.countDocuments({ member: memberId, status: "unpaid" }),
    Reservation.countDocuments({ member: memberId, status: { $in: [...ACTIVE_RESERVATION_STATUSES] } }),
    Fine.aggregate<{ total: number }>([
      { $match: { member: memberId, status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    // Newest first, because a librarian opens this screen to answer "what has this
    // person got out right now". Every sort ends in `_id` so rows sharing a timestamp
    // to the millisecond still have a defined order between requests.
    Loan.find({ member: memberId })
      .sort({ issuedAt: -1, _id: -1 })
      .limit(MEMBER_HISTORY_LIMIT)
      .lean(),
    Fine.find({ member: memberId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MEMBER_HISTORY_LIMIT)
      .lean(),
    Reservation.find({ member: memberId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MEMBER_HISTORY_LIMIT)
      .lean(),
  ]);

  const loans = loanDocs as unknown as Array<Record<string, unknown>>;
  const fines = fineDocs as unknown as Array<Record<string, unknown>>;
  const holds = reservationDocs as unknown as Array<Record<string, unknown>>;

  const [refs, queue] = await Promise.all([
    bookRefs([
      ...loans.map((loan) => loan.book),
      ...fines.map((fine) => fine.book),
      ...holds.map((hold) => hold.book),
    ]),
    queuePositions(holds.map((hold) => hold.book), memberId),
  ]);

  return {
    ...toMember(doc, activeLoans),
    totalBorrowed,
    unpaidFines,
    activeReservations,
    unpaidFineTotal: Math.round(fineAgg[0]?.total ?? 0),

    loans: loans.map((loan) => {
      const dueDate = loan.dueDate as Date;
      const { view, daysLeft, daysOverdue } = deriveLoanState(
        { status: loan.status as LoanStatus, dueDate },
        now,
      );

      return {
        id: String(loan._id),
        book: refFor(refs, loan.book),
        status: loan.status as LoanStatus,
        view,
        issuedAt: (loan.issuedAt as Date).toISOString(),
        dueDate: dueDate.toISOString(),
        returnedAt: loan.returnedAt ? (loan.returnedAt as Date).toISOString() : null,
        renewCount: Number(loan.renewCount ?? 0),
        fineAmount: Number(loan.fineAmount ?? 0),
        notes: (loan.notes as string | null) ?? null,
        daysLeft,
        daysOverdue,
      };
    }),

    fines: fines.map((fine) => ({
      id: String(fine._id),
      book: refFor(refs, fine.book),
      amount: Number(fine.amount ?? 0),
      status: fine.status as FineStatus,
      daysOverdue: Number(fine.daysOverdue ?? 0),
      ratePerDay: Number(fine.ratePerDay ?? 0),
      raisedAt: (fine.createdAt as Date).toISOString(),
      paidAt: fine.paidAt ? (fine.paidAt as Date).toISOString() : null,
      reason: (fine.reason as string | null) ?? null,
    })),

    reservations: holds.map((hold) => ({
      id: String(hold._id),
      book: refFor(refs, hold.book),
      status: hold.status as ReservationStatus,
      queuePosition: queue.get(String(hold._id)) ?? null,
      readyAt: hold.readyAt ? (hold.readyAt as Date).toISOString() : null,
      expiresAt: hold.expiresAt ? (hold.expiresAt as Date).toISOString() : null,
      requestedAt: (hold.createdAt as Date).toISOString(),
    })),
  };
}

/**
 * Type-ahead for the circulation desk (F7).
 *
 * Capped at 8 because this feeds a dropdown, and a member must be identifiable from
 * eight rows — a longer list turns "find the right person" into a second search.
 *
 * **Active members sort first.** A suspended member is still findable (the desk needs
 * to explain why they cannot borrow) but should not sit above someone who can.
 */
export async function lookupMembers(
  q: string,
  limit = 8,
): Promise<Array<PublicUser & { activeLoans: number }>> {
  const rx = new RegExp(escapeRegex(q), "i");

  const docs = await User.find({
    role: "member",
    $or: [{ name: rx }, { email: rx }, { membershipId: rx }],
  })
    .select(MEMBER_FIELDS)
    .sort({ status: 1, name: 1 })
    .limit(Math.min(20, Math.max(1, limit)))
    .lean();

  const rows = docs as unknown as Array<Record<string, unknown>>;
  const counts = await activeLoanCounts(rows.map((doc) => new Types.ObjectId(String(doc._id))));

  return rows.map((doc) => toMember(doc, counts.get(String(doc._id)) ?? 0));
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

/** Load a member or throw. Shared by every member mutation. */
async function requireMember(id: string) {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That member could not be found.");

  const member = await User.findOne({ _id: id, role: "member" });
  if (!member) throw AppError.notFound("That member could not be found.");
  return member;
}

/**
 * Suspend a member (F6).
 *
 * The reason is required and is both stored and notified, because it is the only
 * thing the member will see: `SuspendedBanner` renders it on their next load, so
 * "your account is suspended" with no reason is unactionable.
 */
export async function suspendMember(
  id: string,
  reason: string,
  actor: Actor,
): Promise<PublicUser> {
  const member = await requireMember(id);

  const already = member.status === "suspended";
  member.status = "suspended";
  member.suspendedReason = reason;
  await member.save();

  // Only notify on a real transition, so re-suspending with a new reason still tells
  // the member why it changed.
  await notify({
    userId: member._id,
    type: "account_suspended",
    title: "Your library account is suspended",
    message: reason,
    link: PROFILE_LINK,
  });

  await logAudit({
    actor,
    action: "user.suspend",
    entityType: "User",
    entityId: member._id,
    summary: already
      ? `Updated suspension reason for ${member.email}`
      : `Suspended ${member.email}`,
    meta: { membershipId: member.membershipId ?? null, reason, previousStatus: already ? "suspended" : "active" },
  });

  return toPublicUserish(member);
}

/**
 * Re-activate a member and clear the stored reason.
 *
 * Idempotent: an already-active member is returned untouched, so a double-clicked
 * button cannot send a second "you're active again" notification or write a second
 * audit entry claiming a change that did not happen.
 */
export async function activateMember(id: string, actor: Actor): Promise<PublicUser> {
  const member = await requireMember(id);

  if (member.status === "active") return toPublicUserish(member);

  member.status = "active";
  // Cleared rather than kept: a stale reason would render in the banner of a member
  // who is no longer suspended, which is worse than having no history here (the audit
  // log holds it).
  member.suspendedReason = null;
  await member.save();

  await notify({
    userId: member._id,
    type: "account_activated",
    title: "Your library account is active again",
    message: "You can borrow, reserve and renew books as before.",
    link: PROFILE_LINK,
  });

  await logAudit({
    actor,
    action: "user.activate",
    entityType: "User",
    entityId: member._id,
    summary: `Reactivated ${member.email}`,
    meta: { membershipId: member.membershipId ?? null, previousStatus: "suspended" },
  });

  return toPublicUserish(member);
}

/**
 * Reset a password to a generated temporary one (F6, F1).
 *
 * **The plaintext is returned exactly once** and is never stored, logged or audited —
 * only its existence. The audit entry records that a reset happened, so an admin can
 * see *that* an account was reset without the log becoming a credential store.
 *
 * Staff may reset members; resetting a librarian is admin-only. Enforced here rather
 * than in the route so every caller inherits it.
 */
export async function resetPassword(
  id: string,
  actor: Actor,
): Promise<{ user: PublicUser; temporaryPassword: string }> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound("That user could not be found.");

  const user = await User.findById(id);
  if (!user) throw AppError.notFound("That user could not be found.");

  if (user.role !== "member" && actor.role !== "admin") {
    throw AppError.forbidden("Only an administrator can reset a staff password.");
  }
  if (user.role === "member" && actor.role === "member") {
    throw AppError.forbidden("You cannot reset another user's password.");
  }

  const temporaryPassword = generateTempPassword();
  user.passwordHash = await hashPassword(temporaryPassword);
  await user.save();

  await logAudit({
    actor,
    action: "user.password_reset",
    entityType: "User",
    entityId: user._id,
    summary: `Reset the password for ${user.email}`,
    // No password, no hash, not even a length.
    meta: { role: user.role, membershipId: user.membershipId ?? null },
  });

  return { user: toPublicUserish(user), temporaryPassword };
}