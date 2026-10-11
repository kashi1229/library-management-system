import "server-only";
import { Types } from "mongoose";
import { AuditLog } from "@/models";
import { buildMeta } from "@/lib/api";
import type { Actor, AuditListItem, AuditListResult } from "@/types";
import type { ClientSession } from "mongoose";
import type { AuditAction } from "@/lib/audit-templates";
import type { ListAuditQuery } from "@/lib/validators/report";

/**
 * Append-only audit trail.
 *
 * Invariant 10: audit entries are never updated or deleted. Invariant 11 lists
 * the actions that MUST call this — user create/suspend/activate/password-reset,
 * book create/update/archive/delete, issue/return/renew, fine collect/waive,
 * reservation fulfil/cancel by staff, and settings changes.
 */

/**
 * The action union lives in `lib/audit-templates.ts`, **not here.**
 *
 * It sits next to the icon map that draws it, because that map must be a total `Record` —
 * adding an action without drawing it is a compile error, which is only possible if both halves
 * can be seen from one module. A Client Component cannot import this file (`server-only`), so
 * the dependency had to point the other way: the service is the importer, not the definer.
 */
export type { AuditAction };

export type LogAuditInput = {
  actor: Actor;
  action: AuditAction | string;
  /** Collection name, e.g. `"Book"`, `"Loan"`. */
  entityType: string;
  /** The affected document's id. Accepts an ObjectId or its string form. */
  entityId: Types.ObjectId | string;
  /** One-line description rendered in the admin audit viewer. */
  summary: string;
  /** Optional structured detail (old/new values, counts). */
  meta?: Record<string, unknown>;
  /** Pass the active transaction session so the log commits with its action. */
  session?: ClientSession;
};

/**
 * Write one audit entry. Never throws into the caller: a failed audit write
 * must not roll back a successful circulation action, so problems are logged
 * server-side instead.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const entityId =
      input.entityId instanceof Types.ObjectId
        ? input.entityId
        : new Types.ObjectId(String(input.entityId));

    const entry = {
      actor: input.actor.id,
      action: input.action,
      entityType: input.entityType,
      entityId,
      summary: input.summary.slice(0, 300),
      meta: input.meta ?? {},
    };

    if (input.session) {
      await AuditLog.create([entry], { session: input.session });
    } else {
      await AuditLog.create(entry);
    }
  } catch (error) {
    console.error("[audit] Failed to write audit entry", { action: input.action }, error);
  }
}

/* -------------------------------------------------------------------------- */
/* Reading (spec 18)                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The audit trail, newest first, paginated.
 *
 * **`actor` and `action` are the only two filters that are indexed** — `actor`, `action` and
 * `createdAt` each carry a single-field index, and `auditlog_recent` (`createdAt: -1`) is what
 * serves the sort. `entityType` is deliberately *not* filterable here: it has no index, so a
 * filter on it would be a collection scan over every entry ever written, and the admin would sit
 * watching a spinner on a log that is already append-only and effectively static.
 *
 * **The `summary` recorded at the time of the action is shown, never re-derived.** A deleted
 * book's `book.delete` row must still read as it did; re-joining to a live `Book` would blank
 * the one entry an administrator most wants to read.
 *
 * **Actor names are resolved in one batched `$in`**, the same way `refs.ts` resolves book and
 * member references everywhere else. A column of ObjectIds is unreadable, and the whole point
 * of an audit trail is being able to see who did what.
 */
export async function listAudit(query: ListAuditQuery): Promise<AuditListResult> {
  const filter: Record<string, unknown> = {};

  if (query.actor && Types.ObjectId.isValid(query.actor)) filter.actor = query.actor;
  if (query.action) filter.action = query.action;

  if (query.from || query.to) {
    // Inclusive bounds, resolved as UTC day edges — the same convention `services/reports.ts`
    // uses, so "the 12th" means the same thing on both screens.
    const range: Record<string, Date> = {};
    if (query.from) range.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) range.$lte = new Date(`${query.to}T23:59:59.999Z`);
    filter.createdAt = range;
  }

  // Free-text search over the summary. **Escaped**, because a search box is user input and a
  // typed `.*` is a full scan with a much worse plan.
  if (query.q) {
    const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.summary = { $regex: escaped, $options: "i" };
  }

  const page = Math.max(1, query.page);
  const limit = Math.min(100, query.limit);
  const skip = (page - 1) * limit;

  const [rows, total, distinctActions] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .select("actor action entityType entityId summary meta createdAt")
      .lean<Array<Record<string, unknown>>>(),
    AuditLog.countDocuments(filter),
    // The distinct actions in the *whole* log, not the filtered page, so the filter menu offers
    // real choices rather than only the ones that happen to be on screen.
    AuditLog.distinct("action"),
  ]);

  const actorIds = [...new Set(rows.map((row) => String(row.actor)))].filter((id) =>
    Types.ObjectId.isValid(id),
  );
  const actors = new Map<string, { id: string; name: string; role: Actor["role"] }>();

  if (actorIds.length > 0) {
    const docs = await AuditLog.db
      .collection("users")
      .find(
        { _id: { $in: actorIds.map((id) => new Types.ObjectId(id)) } },
        { projection: { name: 1, role: 1 } },
      )
      .toArray();

    for (const doc of docs) {
      actors.set(String(doc._id), {
        id: String(doc._id),
        name: String(doc.name ?? "Unknown user"),
        role: (doc.role as Actor["role"]) ?? "member",
      });
    }
  }

  const items: AuditListItem[] = rows.map((row) => ({
    id: String(row._id),
    // A deleted staff account leaves the entry with an actor that no longer resolves. "Unknown
    // user" is honest; a blank cell reads as "nobody did this".
    actor: actors.get(String(row.actor)) ?? null,
    action: String(row.action ?? ""),
    entityType: String(row.entityType ?? ""),
    entityId: String(row.entityId ?? ""),
    summary: String(row.summary ?? ""),
    meta: (row.meta as Record<string, unknown>) ?? {},
    createdAt: new Date(row.createdAt as string).toISOString(),
  }));

  const meta = buildMeta(total, page, limit);

  return {
    items,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    actions: distinctActions.filter((action): action is string => typeof action === "string").sort(),
  };
}