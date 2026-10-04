/**
 * Domain enums and shared configuration.
 * Every `as const` array here is the single source of truth reused by Mongoose
 * schemas, zod validators and UI maps (see context/data-model.md).
 */

/* -------------------------------------------------------------------------- */
/* Roles                                                                       */
/* -------------------------------------------------------------------------- */

export const ROLES = ["admin", "librarian", "member"] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES = ["librarian", "admin"] as const satisfies readonly Role[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (role: string): role is StaffRole =>
  (STAFF_ROLES as readonly string[]).includes(role);

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Membership IDs are generated as `LIB-<year>-<4-digit-sequence>`. */
export const MEMBERSHIP_ID_PREFIX = "LIB";
export const MEMBERSHIP_ID_SEQUENCE_LENGTH = 4;

/* -------------------------------------------------------------------------- */
/* Books                                                                       */
/* -------------------------------------------------------------------------- */

export const BOOK_STATUSES = ["active", "archived"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const BOOK_SORTS = ["newest", "title", "popular", "rating"] as const;
export type BookSort = (typeof BOOK_SORTS)[number];

export const BOOK_AVAILABILITY = ["available", "all"] as const;
export type BookAvailability = (typeof BOOK_AVAILABILITY)[number];

/* -------------------------------------------------------------------------- */
/* Circulation                                                                  */
/* -------------------------------------------------------------------------- */

export const LOAN_STATUSES = ["active", "returned"] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

/** Derived (never stored) states used by list filters and status chips. */
export const LOAN_VIEWS = ["active", "returned", "overdue", "due_soon"] as const;
export type LoanView = (typeof LOAN_VIEWS)[number];

export const RESERVATION_STATUSES = [
  "waiting",
  "ready",
  "fulfilled",
  "cancelled",
  "expired",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const ACTIVE_RESERVATION_STATUSES = ["waiting", "ready"] as const satisfies readonly ReservationStatus[];
export type ActiveReservationStatus = (typeof ACTIVE_RESERVATION_STATUSES)[number];

export const FINE_STATUSES = ["unpaid", "paid", "waived"] as const;
export type FineStatus = (typeof FINE_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

export const NOTIFICATION_TYPES = [
  "loan_issued",
  "loan_returned",
  "loan_renewed",
  "due_soon",
  "overdue",
  "fine_created",
  "fine_paid",
  "fine_waived",
  "reservation_ready",
  "reservation_expired",
  "reservation_cancelled",
  "account_suspended",
  "account_activated",
  "new_reservation",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Reports & audit                                                             */
/* -------------------------------------------------------------------------- */

export const REPORT_TYPES = [
  "borrowing",
  "overdue",
  "popular",
  "members",
  "fines",
  "inventory",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/* -------------------------------------------------------------------------- */
/* Category accents                                                            */
/* -------------------------------------------------------------------------- */

export const CATEGORY_COLORS = [
  "forest",
  "terracotta",
  "ocean",
  "plum",
  "ochre",
  "slate",
] as const;
export type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Maps a category accent key to the matching Tailwind token class. */
export const CATEGORY_COLOR_CLASS: Record<CategoryColor, { bg: string; text: string; ring: string }> = {
  forest: { bg: "bg-cat-forest", text: "text-cat-forest", ring: "ring-cat-forest" },
  terracotta: { bg: "bg-cat-terracotta", text: "text-cat-terracotta", ring: "ring-cat-terracotta" },
  ocean: { bg: "bg-cat-ocean", text: "text-cat-ocean", ring: "ring-cat-ocean" },
  plum: { bg: "bg-cat-plum", text: "text-cat-plum", ring: "ring-cat-plum" },
  ochre: { bg: "bg-cat-ochre", text: "text-cat-ochre", ring: "ring-cat-ochre" },
  slate: { bg: "bg-cat-slate", text: "text-cat-slate", ring: "ring-cat-slate" },
};

export const DEFAULT_CATEGORY_ICON = "BookOpen";

/* -------------------------------------------------------------------------- */
/* Routes                                                                      */
/* -------------------------------------------------------------------------- */

export const ROUTES = {
  landing: "/",
  login: "/login",
  register: "/register",
  catalog: "/catalog",
  member: {
    dashboard: "/dashboard",
    loans: "/my-loans",
    reservations: "/reservations",
    wishlist: "/wishlist",
    fines: "/fines",
    notifications: "/notifications",
    profile: "/profile",
  },
  staff: {
    dashboard: "/staff",
    circulation: "/staff/circulation",
    books: "/staff/books",
    categories: "/staff/categories",
    members: "/staff/members",
    reservations: "/staff/reservations",
    fines: "/staff/fines",
    reports: "/staff/reports",
    team: "/staff/team",
    audit: "/staff/audit",
    settings: "/staff/settings",
  },
} as const;

/** Where each role lands after signing in, used by login/register and middleware. */
export const ROLE_HOME: Record<Role, string> = {
  member: ROUTES.member.dashboard,
  librarian: ROUTES.staff.dashboard,
  admin: ROUTES.staff.dashboard,
};

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

export const PAGINATION = {
  defaultPage: 1,
  defaultLimit: 12,
  maxLimit: 100,
} as const;

/* -------------------------------------------------------------------------- */
/* Upload folders                                                              */
/* -------------------------------------------------------------------------- */

export const UPLOAD_FOLDERS = ["covers", "avatars"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const CLOUDINARY_PREFIX = "athenaeum";
