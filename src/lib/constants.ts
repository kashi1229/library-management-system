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

/**
 * Per-category utility classes.
 *
 * `on` is the theme-independent foreground for generated covers and other
 * colour-filled surfaces. It cannot be `primary-foreground`, which flips with
 * the theme and drops to 3.5:1 on terracotta (light) and 1.4:1 on forest (dark).
 */
export const CATEGORY_COLOR_CLASS: Record<
  CategoryColor,
  { bg: string; text: string; ring: string; on: string }
> = {
  forest: {
    bg: "bg-cat-forest",
    text: "text-cat-forest",
    ring: "ring-cat-forest",
    on: "text-cat-ink-light",
  },
  terracotta: {
    bg: "bg-cat-terracotta",
    text: "text-cat-terracotta",
    ring: "ring-cat-terracotta",
    on: "text-cat-ink-dark",
  },
  ocean: {
    bg: "bg-cat-ocean",
    text: "text-cat-ocean",
    ring: "ring-cat-ocean",
    on: "text-cat-ink-light",
  },
  plum: {
    bg: "bg-cat-plum",
    text: "text-cat-plum",
    ring: "ring-cat-plum",
    on: "text-cat-ink-light",
  },
  ochre: {
    bg: "bg-cat-ochre",
    text: "text-cat-ochre",
    ring: "ring-cat-ochre",
    on: "text-cat-ink-dark",
  },
  slate: {
    bg: "bg-cat-slate",
    text: "text-cat-slate",
    ring: "ring-cat-slate",
    on: "text-cat-ink-light",
  },
};

/** Seed-friendly fallbacks, shared by the schema defaults and the seed script. */
export const DEFAULT_CATEGORY_ICON = "BookOpen";
export const DEFAULT_CATEGORY_COLOR: CategoryColor = "forest";

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
/* Navigation config (placeholder structure — rendered by Unit 05 App Shell)     */
/* -------------------------------------------------------------------------- */

export type NavItemConfig = {
  label: string;
  href: string;
  /** Lucide icon name, resolved in Unit 05. */
  icon: string;
  /** Minimum role required to see this entry. */
  roles: readonly Role[];
};

/**
 * Icon names follow ui-context.md §Navigation Items. Stored as strings so this
 * module stays free of JSX and can be imported by Server Components.
 */
export const MEMBER_NAV: readonly NavItemConfig[] = [
  { label: "Dashboard", href: ROUTES.member.dashboard, icon: "LayoutDashboard", roles: ["member", "librarian", "admin"] },
  { label: "Catalog", href: ROUTES.catalog, icon: "Library", roles: ["member", "librarian", "admin"] },
  { label: "My Loans", href: ROUTES.member.loans, icon: "BookMarked", roles: ["member", "librarian", "admin"] },
  { label: "Reservations", href: ROUTES.member.reservations, icon: "Clock", roles: ["member", "librarian", "admin"] },
  { label: "Wishlist", href: ROUTES.member.wishlist, icon: "Heart", roles: ["member", "librarian", "admin"] },
  { label: "Fines", href: ROUTES.member.fines, icon: "Receipt", roles: ["member", "librarian", "admin"] },
  { label: "Notifications", href: ROUTES.member.notifications, icon: "Bell", roles: ["member", "librarian", "admin"] },
  { label: "Profile", href: ROUTES.member.profile, icon: "UserRound", roles: ["member", "librarian", "admin"] },
];

export const STAFF_NAV: readonly NavItemConfig[] = [
  { label: "Dashboard", href: ROUTES.staff.dashboard, icon: "LayoutDashboard", roles: ["librarian", "admin"] },
  { label: "Circulation", href: ROUTES.staff.circulation, icon: "ArrowLeftRight", roles: ["librarian", "admin"] },
  { label: "Books", href: ROUTES.staff.books, icon: "BookOpen", roles: ["librarian", "admin"] },
  { label: "Categories", href: ROUTES.staff.categories, icon: "Tags", roles: ["librarian", "admin"] },
  { label: "Members", href: ROUTES.staff.members, icon: "Users", roles: ["librarian", "admin"] },
  { label: "Reservations", href: ROUTES.staff.reservations, icon: "Clock", roles: ["librarian", "admin"] },
  { label: "Fines", href: ROUTES.staff.fines, icon: "Receipt", roles: ["librarian", "admin"] },
  { label: "Reports", href: ROUTES.staff.reports, icon: "BarChart3", roles: ["librarian", "admin"] },
];

/** Admin-only entries, appended after STAFF_NAV. */
export const ADMIN_NAV: readonly NavItemConfig[] = [
  { label: "Team", href: ROUTES.staff.team, icon: "ShieldCheck", roles: ["admin"] },
  { label: "Audit Log", href: ROUTES.staff.audit, icon: "ScrollText", roles: ["admin"] },
  { label: "Settings", href: ROUTES.staff.settings, icon: "Settings", roles: ["admin"] },
];


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

/* -------------------------------------------------------------------------- */
/* Departments (register form)                                                 */
/* -------------------------------------------------------------------------- */

export const DEPARTMENTS = [
  { value: "Computer Science", label: "Computer Science" },
  { value: "Engineering", label: "Engineering" },
  { value: "Business", label: "Business & Management" },
  { value: "Humanities", label: "Humanities" },
  { value: "Natural Sciences", label: "Natural Sciences" },
  { value: "Social Sciences", label: "Social Sciences" },
  { value: "Arts & Design", label: "Arts & Design" },
  { value: "Law", label: "Law" },
  { value: "Medicine", label: "Medicine & Health" },
  { value: "Mathematics & Statistics", label: "Mathematics & Statistics" },
] as const;
