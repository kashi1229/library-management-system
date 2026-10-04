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
