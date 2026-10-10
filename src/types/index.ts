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
  /**
   * Is this on the signed-in reader's reading list (F10)?
   *
   * **Required, not optional**, even though it only means anything to a signed-in reader.
   * An optional field here would be one a caller can silently forget and then read as
   * `false` — so every heart would render unsaved and the bug would look like the wishlist
   * not working rather than like a missing field. The catalog list reader fills it from the
   * **cookie session only**, in one query for the whole page.
   *
   * Always `false` when there is no session, and on the staff table, where the reader is not
   * browsing books to save them.
   */
  wishlisted: boolean;
};

/** What the signed-in user has in flight for one book, for the detail actions. */
export type UserBookState = {
  wishlisted: boolean;
  /** The member currently has an active loan of this book. */
  activeLoan: boolean;
  /** Reservation status (`waiting`/`ready`) or `null` when they have none. */
  reservation: ReservationStatus | null;
  /**
   * That reservation's own id, or `null` when they have none.
   *
   * **The book id is not a substitute.** Cancelling needs `DELETE /api/reservations/:id`, and
   * the detail page only knows the book's id — sending that would cancel whatever hold the
   * id happened to match, or 404. A control labelled "Cancel" has to actually cancel, not
   * navigate to another page and ask there.
   */
  reservationId: string | null;
  /**
   * Their 1-based place among the people waiting for this book, or `null` when they hold
   * nothing. Also `null` while their own hold is `ready` — see `queuePosition` on
   * `ReservationSummary` for why a ready hold is counted in the order but never numbered.
   *
   * **Carried on the wire rather than derived by the client.** "You'd be #3 in line" needs
   * the place they would get, and "You're #2 in line" needs the place they have. The FIFO
   * order lives in one read in the service, not in a second implementation in a component.
   */
  reservationPosition: number | null;
  /**
   * Whole hours left on *their own* ready hold, rounded up by the server, or `null` unless
   * `reservation` is `ready`.
   *
   * Server-derived for the same reason as `reservationPosition`: the rounding rule for a
   * hold countdown exists once, in `services/reservations.ts`. A component that recomputed
   * it from `expiresAt` would print "0 hours left" while a copy was still on the shelf.
   */
  readyHoldHours: number | null;
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
/* Wishlist & Reviews (spec 15)                                                */
/* -------------------------------------------------------------------------- */

/**
 * One review, as the book page shows it.
 *
 * `isMine` and `canModerate` are **computed server-side from the session**, never derived
 * in the component. A client that worked out "is this mine" by comparing ids would render
 * an Edit/Delete menu on a review it does not own, and the server would then 403 — a
 * control that is offered and then refuses. Deciding at the boundary means a member sees
 * Edit/Delete exactly on their own rows and staff see Remove exactly where they can use it.
 */
/**
 * Dashboards (spec 17).
 *
 * **Every figure here is computed in the database**, never in the browser. A KPI card is the
 * most trusted number on the screen, and a dashboard that contradicted a member's own loan list
 * would cost them their trust in every other number the app shows.
 *
 * `view` on a reading row is the **derived** loan state from `deriveLoanState` — the same
 * function the loan lists use — so the countdown ring on the dashboard and the badge on a loan
 * row can never disagree about the same book (invariant 12).
 */
export type MemberDashboard = {
  kpis: {
    activeLoans: number;
    readyHolds: number;
    /** Count of unpaid fines, which is what a member can act on. */
    unpaidFines: number;
    /** Their total, in currency units — **formatted by the UI**, never rendered raw. */
    unpaidFineTotal: number;
  };
  /** Currently-out books, earliest due first. */
  reading: Array<{
    id: string;
    book: LoanBookRef;
    dueDate: string;
    daysLeft: number;
    view: LoanDisplayState;
    renewCount: number;
    /** Non-null only while somebody else is waiting for the same book. */
    queuePosition: number | null;
  }>;
  /** Holds that are on the desk waiting to be collected. */
  pickups: Array<{
    id: string;
    book: LoanBookRef;
    expiresAt: string | null;
    /** Rounded **up**, by the one shared `hoursUntil` — the same rule the reservations page uses. */
    hoursLeft: number | null;
  }>;
  recommended: LoanBookRef[];
  wishlist: LoanBookRef[];
};

export type DashboardDayPoint = {
  /** `YYYY-MM-DD`, always UTC — the chart's x-axis key and never parsed as a local date. */
  date: string;
  /** Zero-filled: every day in the window appears, including the quiet ones. */
  count: number;
};

export type DashboardLowStockItem = {
  id: string;
  title: string;
  availableCopies: number;
  totalCopies: number;
  borrowCount: number;
};

export type DashboardTopBook = DashboardLowStockItem;

export type DashboardCategoryShare = {
  id: string;
  name: string;
  /**
   * The category's stored `CategoryColor` **name** — not a class, not a hex value.
   *
   * Carried in the payload rather than looked up client-side, because `CATEGORY_COLOR_CLASS` is a
   * module-level map of *class names* and a chart needs an actual colour value (see
   * `use-chart-tokens.ts`). Sending the name means the component resolves both the class for the
   * legend swatch and the live value for the slice through the one definition, instead of the
   * service shipping a class it cannot validate and the client keeping a parallel id→hue table
   * that nothing would keep in step.
   */
  color: CategoryColor;
  /** Summed `borrowCount` over the category, not a loan count. */
  count: number;
};

export type StaffActivityItem = {
  id: string;
  /** The audit action, e.g. `loan.issue`. */
  action: string;
  /** The summary recorded **at the time of the action**, never re-derived. */
  summary: string;
  entityType: string;
  createdAt: string;
};

export type StaffDashboard = {
  kpis: {
    totalTitles: number;
    totalCopies: number;
    /** Out on loan or held, so `totalCopies - availableCopies` explains itself. */
    availableCopies: number;
    members: number;
    activeLoans: number;
    overdue: number;
    readyHolds: number;
    unpaidFines: number;
    unpaidFineTotal: number;
  };
  /** Exactly `seriesDays` points, zero-filled, oldest first. */
  series: DashboardDayPoint[];
  seriesDays: number;
  byCategory: DashboardCategoryShare[];
  topBooks: DashboardTopBook[];
  lowStock: DashboardLowStockItem[];
  dueToday: Array<{
    id: string;
    book: LoanBookRef;
    member: LoanMemberRef;
    dueDate: string;
  }>;
  activity: StaffActivityItem[];
  generatedAt: string;
};

/**
 * One notification as the UI receives it (spec 16).
 *
 * **`tone` is resolved server-side**, because the bell popover, the popover row and the page
 * row all colour a tile by type and a `switch` in each of the three is three places for the
 * palette to disagree. `NOTIFICATION_PRESENTATION` carries the matching icon.
 */
export type NotificationSummary = {
  id: string;
  type: NotificationType;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  message: string;
  /** In-app route to navigate to on click; null when there is nowhere to go. */
  link: string | null;
  readAt: string | null;
  isRead: boolean;
  createdAt: string;
};

export type ReviewSummary = {
  id: string;
  bookId: string;
  rating: number;
  /** Optional — a rating on its own is a complete review. */
  comment: string | null;
  member: { id: string; name: string; avatar: CloudinaryImage | null };
  createdAt: string;
  updatedAt: string;
  /** True when the caller wrote it. */
  isMine: boolean;
  /** True when the caller is staff and may moderate anyone's review. */
  canModerate: boolean;
};

/**
 * The five-bar rating summary.
 *
 * **The counts are real, not derived from the mean.** A mean of 4.3 across 12 ratings
 * could be eleven 5s and one 1, or a genuine spread, and a reader deciding whether to trust
 * a rating needs the spread. `distribution` is index 0 = one star … index 4 = five stars,
 * and always has five entries so the bars render even at zero.
 */
export type RatingSummary = {
  average: number;
  count: number;
  distribution: [number, number, number, number, number];
};

/**
 * The rating summary, the page of reviews, and **the caller's own review**.
 *
 * `mine` is returned regardless of which page is showing. The composer needs it to offer an
 * edit, and a member with more than ten reviews would otherwise be looking at a page their
 * own review is not on — with a composer that quietly offers to create a second one.
 */
export type ReviewListResult = {
  summary: RatingSummary;
  items: ReviewSummary[];
  /** The caller's own review, or `null`. `null` for a visitor. */
  mine: ReviewSummary | null;
};

/** One book on the member's wishlist. */
export type WishlistItem = {
  id: string;
  /** The catalog book, so the card shows the same cover, rating and availability. */
  book: CatalogBook;
  savedAt: string;
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

/* -------------------------------------------------------------------------- */
/* Reservations (spec 14)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One reservation, as the member's own page and the staff register both need it.
 *
 * `status` is the **stored** state (`waiting | ready | fulfilled | cancelled | expired`).
 * There is no derived state here: a hold is either open or it is closed, and rule 7 turns
 * a closed-overdue `ready` hold into `expired` on the next lazy sweep rather than leaving
 * it to be interpreted at read time.
 *
 * `queuePosition` counts **every active holder on the book**, so the first `ready` hold
 * sits at position 1 and the first person `waiting` behind it is #2. That is what a member
 * means by "their place in the queue": three copies returned means three people ahead of
 * you will be served before you are, whoever picked them up.
 *
 * `hoursUntilExpiry` is **server-derived and rounded up**, and only present for a `ready`
 * hold. A hold that has 20 minutes left says "1 hour", never "0 hours" — a countdown that
 * reads zero while a copy is still on the shelf for you is the number a member would
 * screenshot and ask about. The UI never recomputes it from `expiresAt`.
 */
export type ReservationSummary = {
  id: string;
  status: ReservationStatus;
  book: LoanBookRef;
  member: { id: string; name: string; membershipId: string | null };
  /**
   * 1-based place among the people **waiting** for this book. `null` once the hold is
   * `ready` and once it is closed.
   *
   * A `ready` hold still counts towards the arithmetic — three copies returned means the
   * first person still waiting is #4, which is true because three people will be served
   * before them — but carries no number of its own. Giving it one would label two members
   * #1 on the same book, and a member whose copy is already set aside is not waiting for a
   * place. See `activeQueuePositions` in `services/reservations.ts`, which owns the rule.
   */
  queuePosition: number | null;
  /** When the member joined the queue (`createdAt`). */
  requestedAt: string;
  /** When the queue promoted them and a copy was set aside. */
  readyAt: string | null;
  /** `readyAt + reservationHoldHours`. The copy returns to the shelf after this. */
  expiresAt: string | null;
  /** Whole hours until the hold closes, rounded up. `null` unless `status === "ready"`. */
  hoursUntilExpiry: number | null;
  /** The loan created when the hold was fulfilled. */
  fulfilledLoanId: string | null;
  /** When the hold was released, for a cancelled reservation. */
  cancelledAt: string | null;
};

/**
 * A reservation on a member's own record.
 *
 * `Omit<ReservationSummary, "member">` for the same reason `MemberLoan` is
 * `Omit<LoanSummary, "member">`: on a member's own screen, repeating who the row belongs
 * to on every line is noise, and one derived type cannot drift from the list row it is a
 * projection of.
 */
export type MemberReservation = Omit<ReservationSummary, "member">;

/**
 * A member's own holds, already grouped.
 *
 * **Grouped by the server rather than in the component.** The three groups are the whole
 * screen, and grouping a paginated list in the browser silently loses rows the moment a
 * member has more than one page — which is exactly what "Past" always is. `past` is
 * capped at `MEMBER_HISTORY_LIMIT` and `pastTotal` is the real count, so the UI can say
 * "showing the 50 most recent of 340" rather than implying the list is everything.
 */
export type MemberReservations = {
  /** A copy is set aside and waiting to be collected. */
  ready: MemberReservation[];
  /** In the queue, no copy held yet. */
  waiting: MemberReservation[];
  /** Fulfilled, cancelled or expired, newest first. */
  past: MemberReservation[];
  /** Every closed reservation ever, so a capped `past` can admit it. */
  pastTotal: number;
};

/** One place in a book's queue, for the staff "View queue" sheet. */
export type QueueEntry = {
  id: string;
  member: { id: string; name: string; membershipId: string | null };
  status: ReservationStatus;
  /**
   * 1-based place among the people waiting for this book. `null` unless `status` is
   * `waiting` — the same rule as `ReservationSummary.queuePosition`, so the sheet and the
   * list rows cannot disagree about who is where.
   */
  position: number | null;
  requestedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
};

/** The whole live queue for one book. */
export type QueueInfo = {
  bookId: string;
  /** `waiting` + `ready` — everyone currently in the queue for this book. */
  queueLength: number;
  /**
   * This member's own place, or `null` when they hold nothing. Also `null` when their hold
   * is `ready`: their place in the world is the countdown, not a number.
   */
  position: number | null;
  entries: QueueEntry[];
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
