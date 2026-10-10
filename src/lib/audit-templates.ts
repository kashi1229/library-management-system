import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  Ban,
  BookCheck,
  BookPlus,
  CircleSlash,
  ClipboardList,
  HandCoins,
  Hourglass,
  LibraryBig,
  PackageCheck,
  Pencil,
  Quote,
  RefreshCw,
  Repeat,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Tags,
  Trash2,
  TriangleAlert,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon and tone for every audit action — client-safe, and **total**.
 *
 * **This is `lib/notification-templates.ts` applied to the audit trail**, and it exists for the
 * same reason: `Record<AuditAction, …>` rather than `Partial<Record<…>>`, so adding an action to
 * the union without drawing it here is a **compile error** instead of a blank tile in the staff
 * activity feed. The `partial` version was the obvious, forgiving choice and it is exactly the
 * one that would have shipped a silently empty row.
 *
 * **Client-safe by construction:** no `server-only`, no mongoose. `AuditAction` is re-declared
 * here rather than imported from `services/audit.ts`, because that module is `server-only` and a
 * Client Component importing it fails the build. The *service* imports this union instead, so
 * there is still exactly one definition — the direction is reversed from Unit 16's
 * notification types, where the union already lived in `lib/constants.ts`.
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

export type AuditPresentation = {
  icon: LucideIcon;
  /** `-soft` background + `-ink` foreground, per `ui-context.md`'s AA-safe pairing rule. */
  className: string;
};

/**
 * **Grouped by what happened, not alphabetically**, because the icon is a glance-level signal:
 * a librarian scanning the feed should be able to see circulation, then moderation, then
 * administration without reading any text.
 */
export const AUDIT_PRESENTATION: Record<AuditAction, AuditPresentation> = {
  /* Circulation — the bulk of the trail, and the icons a librarian reads fastest. */
  "loan.issue": { icon: BookCheck, className: "bg-info-soft text-info-ink" },
  "loan.return": { icon: LibraryBig, className: "bg-success-soft text-success-ink" },
  "loan.renew": { icon: Repeat, className: "bg-info-soft text-info-ink" },

  /* Reservations. `expire` is muted, not warning: it is the clock, not a problem. */
  "reservation.create": { icon: ClipboardList, className: "bg-muted text-muted-foreground" },
  "reservation.cancel": { icon: CircleSlash, className: "bg-muted text-muted-foreground" },
  "reservation.fulfil": { icon: PackageCheck, className: "bg-success-soft text-success-ink" },
  "reservation.expire": { icon: Hourglass, className: "bg-muted text-muted-foreground" },

  /* Fines. `create` is the automatic one from a late return, so it is warning not danger. */
  "fine.create": { icon: TriangleAlert, className: "bg-warning-soft text-warning-ink" },
  "fine.collect": { icon: HandCoins, className: "bg-success-soft text-success-ink" },
  "fine.waive": { icon: BadgeCheck, className: "bg-muted text-muted-foreground" },

  /* Catalog. */
  "book.create": { icon: BookPlus, className: "bg-success-soft text-success-ink" },
  "book.update": { icon: Pencil, className: "bg-info-soft text-info-ink" },
  "book.archive": { icon: Archive, className: "bg-muted text-muted-foreground" },
  "book.restore": { icon: ArchiveRestore, className: "bg-success-soft text-success-ink" },
  "book.delete": { icon: Trash2, className: "bg-danger-soft text-danger-ink" },
  "book.bulk_archive": { icon: Archive, className: "bg-muted text-muted-foreground" },

  "category.create": { icon: Tags, className: "bg-success-soft text-success-ink" },
  "category.update": { icon: Pencil, className: "bg-info-soft text-info-ink" },
  "category.delete": { icon: Trash2, className: "bg-danger-soft text-danger-ink" },

  /* Reviews — moderation is a librarian action, so `delete` is the danger tone here. */
  "review.create": { icon: Quote, className: "bg-success-soft text-success-ink" },
  "review.update": { icon: Pencil, className: "bg-info-soft text-info-ink" },
  "review.delete": { icon: Trash2, className: "bg-danger-soft text-danger-ink" },

  /* People. */
  "user.create": { icon: UserPlus, className: "bg-success-soft text-success-ink" },
  "user.suspend": { icon: UserRoundX, className: "bg-danger-soft text-danger-ink" },
  "user.activate": { icon: UserRoundCheck, className: "bg-success-soft text-success-ink" },
  "user.password_reset": { icon: RotateCcw, className: "bg-warning-soft text-warning-ink" },
  "user.password_change": { icon: RotateCcw, className: "bg-muted text-muted-foreground" },

  /* Staff & administration. */
  "team.create": { icon: ShieldCheck, className: "bg-success-soft text-success-ink" },
  "team.update": { icon: ShieldCheck, className: "bg-info-soft text-info-ink" },
  "settings.update": { icon: ScrollText, className: "bg-info-soft text-info-ink" },
  "maintenance.run": { icon: RefreshCw, className: "bg-muted text-muted-foreground" },
};

/** Used for an action string the server added after this build. Never blank. */
export const AUDIT_FALLBACK: AuditPresentation = { icon: Ban, className: "bg-muted text-muted-foreground" };

/**
 * Look up an action's presentation, tolerating an unknown string.
 *
 * The wire type is `string`, not `AuditAction`: the audit log is append-only and a row written
 * by a newer deployment must still render in an older one. A `Record` lookup alone would return
 * `undefined` and crash the feed — which is the one screen that must never fail, because it is
 * what an administrator reads when something has gone wrong.
 */
export function auditPresentation(action: string): AuditPresentation {
  return AUDIT_PRESENTATION[action as AuditAction] ?? AUDIT_FALLBACK;
}