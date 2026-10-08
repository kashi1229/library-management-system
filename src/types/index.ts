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

/* -------------------------------------------------------------------------- */
/* Fines (spec 13)                                                             */
/* -------------------------------------------------------------------------- */

/**
 * One fine, as a member or a staff member sees it.
 *
 * `amount` is the **total** fine, and it does not change: collecting marks the fine `paid`,
 * it does not reduce it. There is deliberately no `amountPaid` — a part payment would need
 * a second field, a "part-paid" status and a partial state machine, and nothing in the
 * specification asks for one. The service refuses a part payment with the outstanding
 * figure rather than pretending to support it.
 *
 * `ratePerDay` is a **snapshot** of the policy when the fine was raised, so raising
 * `finePerDay` next month does not retroactively change what this member was charged.
 */
export type FineSummary = {
  id: string;
  loanId: string;
  bookId: string;
  memberId: string;
  daysOverdue: number;
  ratePerDay: number;
  /** Currency units. Never reduced — `status` carries the lifecycle. */
  amount: number;
  status: FineStatus;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  reason: string | null;
  note: string | null;
  raisedAt: string;
};

/** A fine row, with the book and member it belongs to. */
export type FineListItem = FineSummary & {
  book: LoanBookRef;
  member: { id: string; name: string; membershipId: string | null };
};

/** The three figures the staff fine page leads with. */
export type FineTotals = {
  /** Everything the library is owed right now, over all unpaid fines. */
  unpaidTotal: number;
  collectedThisMonth: number;
  waivedThisMonth: number;
};

/* -------------------------------------------------------------------------- */
/* Loans (spec 11)                                                             */
/* -------------------------------------------------------------------------- */

/** Just enough of a book for a loan row. Deliberately smaller than `MemberBookRef`. */
export type LoanBookRef = {
  id: string;
  title: string;
  authors: string[];
  cover: CloudinaryImage | null;
  slug: string;
};

/** Just enough of a member for a loan row. Never includes the email unless asked. */
export type LoanMemberRef = {
  id: string;
  name: string;
  membershipId: string | null;
  avatar: CloudinaryImage | null;
};

/**
 * One loan, as the circulation desk and "My Loans" both need it.
 *
 * `status` is the **stored** state and `view` is the **derived** one. `overdue` and
 * `due_soon` never exist in the database (invariant 4), so `circulation.ts` derives
 * them once and puts them on the wire. A client that recomputed them would have to
 * re-derive the rule, and the desk and the member's own page would then disagree about
 * whether a book is late.
 *
 * `fineAmount` is denormalised onto the loan document precisely so a list never has to
 * join the `Fine` collection.
 */
export type LoanSummary = {
  id: string;
  book: LoanBookRef;
  member: LoanMemberRef;
  /** Stored: `active` or `returned`. */
  status: LoanStatus;
  /** Derived for display and for the `overdue` / `due_soon` filters. */
  view: LoanDisplayState;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  renewCount: number;
  fineAmount: number;
  /** Staff-only note captured at the desk. */
  notes: string | null;
  /** Whole days until the due date. Negative once overdue, `0` once returned. */
  daysLeft: number;
  /** Whole days past the due date. `0` unless `view` is `overdue`. */
  daysOverdue: number;
};

/**
 * The shape returned by a return.
 *
 * `fine` is the point of the extra field: returning a book late is the moment a fine is
 * created, and the desk needs to say so immediately rather than send the member away and
 * have them discover it later. `null` until Unit 13 gives the fine real content.
 */
export type LoanReturnResult = {
  loan: LoanSummary;
  fine: LoanFineRef | null;
};

/** The fine raised by a return, or the existing one on the loan. */
export type LoanFineRef = {
  id: string;
  amount: number;
  status: FineStatus;
  daysOverdue: number;
  ratePerDay: number;
};

/**
 * The book on a member record.
 *
 * An alias of `LoanBookRef`, so a loan row is the same shape wherever it appears —
 * the circulation desk, "My Loans", and the member's own history. Two declarations of
 * "a book as shown next to a loan" is how the Unit 08 payload drifted.
 *
 * Carrying `slug` also means the member record can link straight to
 * `/catalog/[slug]` instead of guessing a search query from the title.
 */
export type MemberBookRef = LoanBookRef;

/**
 * The derived, displayable state of a loan.
 *
 * **Deliberately wider than `LoanView`.** `LoanView` is the *filter* vocabulary
 * (`active | returned | overdue | due_soon`) that `api-contract.md` defines for the
 * circulation desk. A loan out on time has no filter of its own — it is simply
 * `active` — but it does have a display state, and `on_time` is what `STATUS_TONES`
 * already maps to success. Reusing `LoanView` here would paint an "active" badge on a
 * loan that is entirely in good standing.
 */
export type LoanDisplayState = "on_time" | "due_soon" | "overdue" | "returned";

/**
 * One loan on a member's record.
 *
 * `status` is the **stored** state and `view` is the **derived** one. `overdue` and
 * `due_soon` never exist in the database (invariant 4: derived, never stored), so the
 * service computes them once and hands them over. A client that recomputed them would
 * have to re-derive the rule, and would then disagree with the circulation desk in
 * Unit 11/12 — two answers to "is this late?" is exactly the bug worth designing out.
 */
/**
 * The member record's loans, as returned by `GET /api/members/:id`.
 *
 * `Omit<LoanSummary, "member">` rather than a separate declaration. The two used to be
 * independent types describing the same row, which is how the Unit 08 book payload
 * drifted into a type error with no visible cause; deriving one from the other means a
 * field added to a loan reaches the member record automatically.
 *
 * `member` is the only omission: on the member's own record, repeating who the loan
 * belongs to on every row is noise, and the desk's version keeps it.
 */
export type MemberLoan = Omit<LoanSummary, "member">;

export type MemberFine = {
  id: string;
  book: MemberBookRef;
  /** Currency units. */
  amount: number;
  status: FineStatus;
  daysOverdue: number;
  /** What the daily rate was when the fine was raised, so it can be shown as history. */
  ratePerDay: number;
  raisedAt: string;
  paidAt: string | null;
  reason: string | null;
};

export type MemberReservation = {
  id: string;
  book: MemberBookRef;
  status: ReservationStatus;
  /** 1-based place in the FIFO queue. `null` once `ready` or once the hold closed. */
  queuePosition: number | null;
  readyAt: string | null;
  expiresAt: string | null;
  requestedAt: string;
};

/**
 * `GET /api/members/:id` — the whole record.
 *
 * Counts and rows are both here on purpose. A librarian looking at a member wants the
 * lifetime total *and* the recent activity; making the client add one up from a
 * truncated list would produce a number that silently disagrees with the header above it.
 *
 * Each list is capped at `MEMBER_HISTORY_LIMIT`, newest first, and the counts are the
 * real totals — so the UI can say "showing the 50 most recent of 340" rather than
 * implying the list is complete.
 */
export type MemberRecord = PublicUser & {
  activeLoans: number;
  /** Every loan ever, returned or not. */
  totalBorrowed: number;
  unpaidFines: number;
  /** `waiting` + `ready`. */
  activeReservations: number;
  /** Outstanding fine total in currency units, not a count. */
  unpaidFineTotal: number;
  loans: MemberLoan[];
  fines: MemberFine[];
  reservations: MemberReservation[];
};
