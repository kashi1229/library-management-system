import type { Types } from "mongoose";
import type {
  BookStatus,
  CategoryColor,
  FineStatus,
  LoanStatus,
  NotificationType,
  PaymentMethod,
  ReservationStatus,
  Role,
  UserStatus,
} from "@/lib/constants";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

export type ObjectIdLike = Types.ObjectId | string;

/** Cloudinary asset reference. MongoDB stores the shape, never the bytes. */
export type CloudinaryImage = {
  url: string;
  publicId: string;
};

/** A Mongoose document stripped of methods and internal bookkeeping. */
export type LeanDoc<T> = Omit<T, "save" | "deleteOne" | "updateOne" | "toObject" | "toJSON"> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

/* -------------------------------------------------------------------------- */
/* Domain documents                                                            */
/* -------------------------------------------------------------------------- */

export type UserDoc = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  /** Never leaves the server and never enters a response. */
  passwordHash: string;
  role: Role;
  membershipId?: string | null;
  phone?: string | null;
  department?: string | null;
  avatar?: CloudinaryImage | null;
  status: UserStatus;
  suspendedReason?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CategoryDoc = {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string | null;
  icon: string;
  color: CategoryColor;
  createdAt: Date;
  updatedAt: Date;
};

export type BookDoc = {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  authors: string[];
  isbn?: string | null;
  publisher?: string | null;
  edition?: string | null;
  publishedYear?: number | null;
  language: string;
  category: Types.ObjectId;
  tags: string[];
  description?: string | null;
  pageCount?: number | null;
  cover?: CloudinaryImage | null;
  shelfLocation?: string | null;
  totalCopies: number;
  /** System-managed. Only circulation services and total-copy edits write this. */
  availableCopies: number;
  status: BookStatus;
  ratingAvg: number;
  ratingCount: number;
  borrowCount: number;
  addedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LoanDoc = {
  _id: Types.ObjectId;
  book: Types.ObjectId;
  member: Types.ObjectId;
  issuedBy?: Types.ObjectId | null;
  issuedAt: Date;
  dueDate: Date;
  returnedAt?: Date | null;
  receivedBy?: Types.ObjectId | null;
  renewCount: number;
  status: LoanStatus;
  fineAmount: number;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FineDoc = {
  _id: Types.ObjectId;
  loan: Types.ObjectId;
  member: Types.ObjectId;
  book: Types.ObjectId;
  daysOverdue: number;
  ratePerDay: number;
  amount: number;
  status: FineStatus;
  paidAt?: Date | null;
  collectedBy?: Types.ObjectId | null;
  paymentMethod?: PaymentMethod | null;
  waivedBy?: Types.ObjectId | null;
  reason?: string | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReservationDoc = {
  _id: Types.ObjectId;
  book: Types.ObjectId;
  member: Types.ObjectId;
  status: ReservationStatus;
  readyAt?: Date | null;
  expiresAt?: Date | null;
  fulfilledLoan?: Types.ObjectId | null;
  cancelledBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WishlistDoc = {
  _id: Types.ObjectId;
  member: Types.ObjectId;
  book: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type ReviewDoc = {
  _id: Types.ObjectId;
  book: Types.ObjectId;
  member: Types.ObjectId;
  rating: number;
  comment?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationDoc = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  readAt?: Date | null;
  /** `type:id:YYYY-MM-DD` — makes the maintenance job idempotent per day. */
  dedupeKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AuditLogDoc = {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  action: string;
  entityType: string;
  entityId: Types.ObjectId;
  summary: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type SettingDoc = {
  _id: Types.ObjectId;
  key: string;
  libraryName: string;
  contactEmail?: string | null;
  loanPeriodDays: number;
  maxActiveLoans: number;
  maxRenewals: number;
  renewalExtensionDays: number;
  finePerDay: number;
  maxFinePerLoan: number;
  fineBlockThreshold: number;
  reservationHoldHours: number;
  maxReservationsPerMember: number;
  currencyCode: string;
  currencySymbol: string;
  lastMaintenanceAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/* -------------------------------------------------------------------------- */
/* API payload shapes                                                          */
/* -------------------------------------------------------------------------- */

/** Pagination envelope metadata returned by every list endpoint. */
export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** The authenticated actor passed into every service. */
export type Actor = {
  id: Types.ObjectId;
  role: Role;
};

/**
 * The book payload as it travels over the API.
 *
 * Defined here rather than in the service or in `api-client` because **both** need
 * it: the service produces it and the client consumes it. When the two declared
 * their own copies they drifted — the service emitted `isbn?: string | null`
 * (optional, mirroring the Mongoose field) while the client declared it required —
 * and passing a service result into a client component became a type error with no
 * obvious cause. One shared shape makes that class of drift impossible.
 *
 * Note what is *not* here: `availableCopies` is present and readable, but it is
 * never accepted from a client. Only circulation and total-copy edits write it
 * (invariant 6).
 */
export type BookSummary = {
  _id: string;
  title: string;
  slug: string;
  authors: string[];
  isbn: string | null;
  publisher: string | null;
  edition: string | null;
  publishedYear: number | null;
  language: string;
  category: {
    _id: string;
    name: string;
    slug: string;
    icon: string;
    color: CategoryColor;
  };
  tags: string[];
  description: string | null;
  pageCount: number | null;
  cover: CloudinaryImage | null;
  shelfLocation: string | null;
  totalCopies: number;
  /** System-managed. Only circulation services and total-copy edits change this. */
  availableCopies: number;
  status: BookStatus;
  ratingAvg: number;
  ratingCount: number;
  borrowCount: number;
  createdAt: string;
  updatedAt: string;
};

/** A single book plus the two derived numbers the staff UI shows. */
export type BookDetail = BookSummary & {
  /** Copies currently out on loan: `totalCopies - availableCopies`. */
  onLoan: number;
  /** Waiting + ready reservations. Tells staff whether a delete would be blocked. */
  waitingReservations: number;
};

/**
 * A book as the **public catalog** sees it (F5).
 *
 * `effectiveAvailable` is `availableCopies` minus copies promised to *ready*
 * reservations. Those two numbers are deliberately different: a copy held for 48h
 * for the next person in the queue is not available to anyone else, so a catalog
 * that showed `availableCopies` would promise a book that cannot be collected.
 * Rule 6 in `architecture.md`.
 */
export type CatalogBook = BookSummary & {
  effectiveAvailable: number;
};

/** What the signed-in user has in flight for one book, for the detail actions. */
export type UserBookState = {
  wishlisted: boolean;
  /** The member currently has an active loan of this book. */
  activeLoan: boolean;
  /** Reservation status (`waiting`/`ready`) or `null` when they have none. */
  reservation: ReservationStatus | null;
};

/** Public catalog detail: everything a reader needs to decide, nothing they can't use. */
export type CatalogBookDetail = CatalogBook & {
  /** People waiting ahead of them. Drives "All copies out · N waiting". */
  queueLength: number;
  userState: UserBookState;
};

/** Category counts + the languages actually present, for the catalog filter panel. */
export type CatalogFacets = {
  categories: Array<{
    _id: string;
    name: string;
    slug: string;
    icon: string;
    color: CategoryColor;
    /** Active books in this category, regardless of the other active filters. */
    count: number;
  }>;
  languages: string[];
  /** Widest publication year present, so the year range slider can be bounded. */
  yearRange: { from: number; to: number };
};

/** Safe user projection — `passwordHash` must never appear. */
export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  membershipId: string | null;
  phone: string | null;
  department: string | null;
  avatar: CloudinaryImage | null;
  status: UserStatus;
  suspendedReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};
