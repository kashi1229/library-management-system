import { Schema, model, models, type Model } from "mongoose";
import type { AuditLogDoc } from "@/types";

/**
 * Append-only audit trail (invariant 10: never updated, never deleted).
 * There is deliberately no update or delete path in the service layer either.
 */
const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Dotted action name, e.g. `loan.issue`, `book.archive`. */
    action: { type: String, required: true, trim: true, maxlength: 80, index: true },
    entityType: { type: String, required: true, trim: true, maxlength: 40 },
    entityId: { type: Schema.Types.ObjectId, required: true },
    /** Human-readable one-liner shown in the audit viewer. */
    summary: { type: String, required: true, trim: true, maxlength: 300 },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true, versionKey: false },
    toObject: { virtuals: true, versionKey: false },
  },
);

AuditLogSchema.index({ createdAt: -1 }, { name: "auditlog_recent" });

export type AuditLogModel = Model<AuditLogDoc>;

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ?? model<AuditLogDoc>("AuditLog", AuditLogSchema);
