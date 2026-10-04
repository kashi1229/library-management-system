import "server-only";
import { Types } from "mongoose";
import { AuditLog } from "@/models";
import type { Actor } from "@/types";
import type { ClientSession } from "mongoose";

/**
 * Append-only audit trail.
 *
 * Invariant 10: audit entries are never updated or deleted. Invariant 11 lists
 * the actions that MUST call this — user create/suspend/activate/password-reset,
 * book create/update/archive/delete, issue/return/renew, fine collect/waive,
 * reservation fulfil/cancel by staff, and settings changes.
 */

export type AuditAction =
  | "user.create"
  | "user.suspend"
  | "user.activate"
  | "user.password_reset"
  | "user.password_change"
  | "team.create"
  | "team.update"
  | "category.create"
  | "category.update"
  | "category.delete"
  | "book.create"
  | "book.update"
  | "book.archive"
  | "book.restore"
  | "book.delete"
  | "book.bulk_archive"
  | "loan.issue"
  | "loan.return"
  | "loan.renew"
  | "reservation.create"
  | "reservation.cancel"
  | "reservation.fulfil"
  | "reservation.expire"
  | "fine.create"
  | "fine.collect"
  | "fine.waive"
  | "review.create"
  | "review.update"
  | "review.delete"
  | "settings.update"
  | "maintenance.run";

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
