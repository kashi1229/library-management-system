import type { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { FieldErrors } from "@/lib/api";
import type {
  BookSort,
  BookAvailability,
  CategoryColor,
  FineStatus,
  LoanView,
  PaymentMethod,
  ReportType,
  ReservationStatus,
  StaffRole,
  UserStatus,
} from "@/lib/constants";
import type { CategoryIconName } from "@/lib/validators/category";
import type { BookStatusFilter, PublicBookSort } from "@/lib/validators/book";
import type {
  AuditListResult,
  BookDetail,
  BookSummary,
  CatalogBook,
  CatalogBookDetail,
  CatalogFacets,
  CloudinaryImage,
  MemberRecord,
  PageMeta,
  PublicUser,
  ReportResult,
} from "@/types";

/** The query shape `GET /api/reports/:type` accepts. */
export type ReportFilters = {
  from?: string;
  to?: string;
  categoryId?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  limit?: number;
};

/** The query shape `GET /api/audit` accepts. */
export type AuditFilters = {
  actor?: string;
  action?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
};

// Fine wire shapes are **imported** (so this file can use them) and separately re-exported
// below for components. `export … from` alone does not bring a name into local scope.
import type {
  FineListItem,
  FineTotals,
  LoanReturnResult,
  LoanSummary,
  MemberReservations,
  NotificationSummary,
  RatingSummary,
  ReservationSummary,
  ReviewListResult,
  ReviewSummary,
  WishlistItem,
} from "@/types";

/**
 * Typed client for the API.
 *
 * Every mutating request sends `Content-Type: application/json`, which combined
 * with the `SameSite=Lax` session cookie is the CSRF mitigation described in
 * `code-standards.md` §Security: a cross-site form post cannot produce a
 * well-formed JSON request, and same-site cookies are not attached to it.
 */

export type ApiError = {
  code: string;
  message: string;
  fields?: FieldErrors;
};

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: FieldErrors;

  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.code = error.code;
    this.status = status;
    this.fields = error.fields;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
};

/** Build a query string, dropping empty values so URLs stay shareable and clean. */
export function buildQuery(query?: RequestOptions["query"]): string {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }

  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

/**
 * Perform the request and return the envelope's `data`, discarding `meta`.
 *
 * Most endpoints have no pagination, so `request` stays the simple shape. List
 * endpoints that do should use `requestWithMeta` instead of re-fetching or
 * guessing totals from `items.length`, which is wrong the moment a page is full.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await send<T>(path, options)).data;
}

/** As `request`, but keeps the pagination `meta` block from the envelope. */
async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: PageMeta }> {
  return send<T>(path, options);
}

async function send<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const { method = "GET", body, signal } = options;

  const response = await fetch(`/api${path}${buildQuery(options.query)}`, {
    method,
    // Session lives in an httpOnly cookie, so it must ride along explicitly.
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as ApiSuccess<T> | ApiFailure | null;

  if (!response.ok || !payload || payload.success === false) {
    const error = payload && "error" in payload ? payload.error : null;
    throw new ApiRequestError(
      response.status,
      error ?? { code: "INTERNAL", message: "Something went wrong. Please try again." },
    );
  }

  return payload;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export type AuthPayload = {
  user: PublicUser;
  /** Where the client should send the user after a successful sign-in. */
  redirectTo: string;
};

export const authApi = {
  register: (input: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
    department?: string;
  }) => request<AuthPayload>("/auth/register", { method: "POST", body: input }),

  login: (input: { email: string; password: string }) =>
    request<AuthPayload>("/auth/login", { method: "POST", body: input }),

  logout: () => request<{ success: boolean }>("/auth/logout", { method: "POST" }),

  me: (signal?: AbortSignal) => request<{ user: PublicUser }>("/auth/me", { signal }),

  changePassword: (input: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    request<{ changed: boolean }>("/auth/password", { method: "PATCH", body: input }),
};

/* -------------------------------------------------------------------------- */
/* Profile & uploads                                                           */
/* -------------------------------------------------------------------------- */

export const profileApi = {
  me: (signal?: AbortSignal) => request<{ user: PublicUser }>("/profile", { signal }),

  /**
   * `avatar` is tri-state: an object replaces it, `null` removes it, and
   * omitting the key leaves it untouched.
   */
  update: (input: {
    name: string;
    phone?: string;
    department?: string;
    avatar?: CloudinaryImage | null;
  }) => request<{ user: PublicUser }>("/profile", { method: "PATCH", body: input }),
};

export type SignedUpload = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  allowedFormats: string;
  maxFileSizeBytes: number;
};

export const uploadsApi = {
  sign: (folder: "covers" | "avatars") =>
    request<SignedUpload>("/uploads/sign", { method: "POST", body: { folder } }),

  remove: (publicId: string) =>
    request<{ deleted: boolean; removed: boolean }>("/uploads", {
      method: "DELETE",
      body: { publicId },
    }),
};

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Public shape; mirrors `CategorySummary` on the server, serialised by
 * `toCategorySummary`. Declared here as well as there for the same reason the book
 * types live in `types/index.ts` — two copies of one interface drift, and the
 * drift only surfaces as a type error somewhere unrelated.
 */
export type CategorySummary = {
  _id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Always one of `CATEGORY_ICON_NAMES`. */
  icon: CategoryIconName;
  /** Always one of the six `CATEGORY_COLORS` keys. */
  color: CategoryColor;
  bookCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryInput = {
  name: string;
  description?: string;
  /** Always one of `CATEGORY_ICON_NAMES`. */
  icon?: CategoryIconName;
  /** Always one of the six `CATEGORY_COLORS` keys. */
  color?: CategoryColor;
};

/* -------------------------------------------------------------------------- */
/* Books                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Book payload shapes are declared in `types/index.ts` and re-exported here, so
 * the client and the service cannot disagree about the wire format. See the note
 * on `BookSummary` there.
 */
export type { BookDetail, BookSummary } from "@/types";

/** The category object embedded in every book payload. */
export type BookCategory = BookSummary["category"];

export type { CatalogBook, CatalogBookDetail, CatalogFacets };

/** Mirrors `createBookSchema`'s output; the form builds this shape directly. */
export type BookInput = {
  title: string;
  authors: string[];
  isbn?: string;
  publisher?: string;
  edition?: string;
  publishedYear?: number;
  language?: string;
  category: string;
  tags?: string[];
  description?: string;
  pageCount?: number;
  shelfLocation?: string;
  totalCopies: number | string;
  cover?: CloudinaryImage | null;
};

/** Every filter the staff table can send, matching `staffBooksQuerySchema`. */
export type BookListFilters = {
  q?: string;
  category?: string;
  language?: string;
  status?: BookStatusFilter;
  sort?: BookSort;
  page?: number;
  limit?: number;
};

/** The catalog's filters, matching `listBooksQuerySchema` plus the reader sorts. */
export type CatalogFilters = {
  q?: string;
  category?: string;
  language?: string;
  /** `available` keeps only books a reader could borrow today. */
  availability?: BookAvailability;
  yearFrom?: number;
  yearTo?: number;
  sort?: PublicBookSort;
  page?: number;
  limit?: number;
};

/** The filters the catalog sends. `status` is absent — the public catalog is active-only. */
export type CatalogQuery = Omit<CatalogFilters, "status">;

export const booksApi = {
  /** Returns the page of books **and** its `meta`, so pagination is exact. */
  list: (filters: BookListFilters = {}, signal?: AbortSignal) =>
    requestWithMeta<{ items: BookSummary[] }>("/books", { query: filters, signal }),

  get: (idOrSlug: string, signal?: AbortSignal) =>
    request<{ book: BookDetail }>(`/books/${idOrSlug}`, { signal }).then((d) => d.book),

  create: (input: BookInput) =>
    request<{ book: BookDetail }>("/books", { method: "POST", body: input }).then((d) => d.book),

  update: (id: string, input: Partial<BookInput>) =>
    request<{ book: BookDetail }>(`/books/${id}`, { method: "PATCH", body: input }).then(
      (d) => d.book,
    ),

  setArchived: (id: string, archived: boolean) =>
    request<{ book: BookDetail }>(`/books/${id}/archive`, {
      method: "POST",
      body: { archived },
    }).then((d) => d.book),

  remove: (id: string) => request<{ id: string }>(`/books/${id}`, { method: "DELETE" }),

  bulkArchive: (ids: string[]) =>
    request<{ archived: number; ids: string[]; skipped: number }>("/books/bulk-archive", {
      method: "POST",
      body: { ids },
    }),
};

/** Public catalog (F5). Separate from `booksApi` because the shapes differ. */
export const catalogApi = {
  list: (filters: CatalogFilters = {}, signal?: AbortSignal) =>
    requestWithMeta<{ items: CatalogBook[] }>("/books", { query: filters, signal }),

  /** Category counts, languages present and the publication year bounds. */
  facets: (signal?: AbortSignal) =>
    request<{ facets: CatalogFacets }>("/books/facets", { signal }).then((d) => d.facets),

  get: (idOrSlug: string, signal?: AbortSignal) =>
    request<{ book: CatalogBookDetail }>(`/books/${idOrSlug}`, { signal }).then((d) => d.book),

  related: (idOrSlug: string, signal?: AbortSignal) =>
    request<{ items: CatalogBook[] }>(`/books/${idOrSlug}/related`, { signal }).then((d) => d.items),
};

/* -------------------------------------------------------------------------- */
/* Members & team                                                             */
/* -------------------------------------------------------------------------- */

/** A member row: the user plus the one count the table shows. */
export type MemberSummary = PublicUser & {
  /** Loans currently out. */
  activeLoans: number;
};

/**
 * The full member record: counts **and** the loan, fine and reservation rows.
 *
 * An alias for the one declaration in `types/index.ts`. Declaring it here as well is how
 * the Unit 08 book payload drifted into a type error with no visible cause — the service
 * and the client each had their own copy and they disagreed on a nullability.
 */
export type MemberDetail = MemberRecord;

/**
 * The per-row shapes, re-exported so a component imports its props from one place.
 *
 * Same reasoning as the books block above: these are wire shapes, so `types/index.ts`
 * owns them and this module only hands them on.
 */
export type { MemberBookRef, MemberFine, MemberLoan, MemberRecord, MemberReservation } from "@/types";

/** A librarian or admin. `PublicUser` already carries the role and status. */
export type TeamMember = PublicUser;

/** Every filter the members table can send, mirroring `listMembersQuerySchema`. */
export type MemberListFilters = {
  q?: string;
  status?: UserStatus;
  page?: number;
  limit?: number;
};

export type CreateStaffMemberInput = {
  name: string;
  email: string;
  /** Must satisfy the shared password policy. */
  password: string;
  phone?: string;
  /**
   * Omitted means `librarian`. Only an admin may send `admin` — the service enforces
   * that independently of this screen.
   */
  role?: StaffRole;
};

/**
 * The one and only time a temporary password exists in plaintext.
 *
 * It is never stored and never logged, so this response is the only chance to show
 * it. Every type here should keep reminding the UI of that.
 */
export type PasswordResetResult = {
  user: PublicUser;
  temporaryPassword: string;
};

export const membersApi = {
  list: (filters: MemberListFilters = {}, signal?: AbortSignal) =>
    requestWithMeta<{ items: MemberSummary[] }>("/members", { query: filters, signal }),

  /**
   * One member by id, with their whole record.
   *
   * This is what the circulation desk's deep link needs: the "Issue a book" link carries
   * `?memberId=<Mongo ObjectId>`, and `lookup` searches **name, email and membership ID** —
   * not `_id` — so passing an ObjectId to `lookup` returns an empty list and the desk
   * silently arrives with nobody selected.
   */
  get: (id: string, signal?: AbortSignal) =>
    request<{ member: MemberDetail }>(`/members/${id}`, { signal }).then((d) => d.member),

  /** Circulation desk type-ahead. Capped at 8 server-side. */
  lookup: (q: string, signal?: AbortSignal) =>
    request<{ items: MemberSummary[] }>("/members/lookup", { query: { q }, signal }).then(
      (d) => d.items,
    ),

  suspend: (id: string, reason: string) =>
    request<{ member: PublicUser }>(`/members/${id}/suspend`, {
      method: "POST",
      body: { reason },
    }).then((d) => d.member),

  activate: (id: string) =>
    request<{ member: PublicUser }>(`/members/${id}/activate`, { method: "POST" }).then(
      (d) => d.member,
    ),

  /** Returns the temporary password once; it cannot be retrieved again. */
  resetPassword: (id: string) =>
    request<PasswordResetResult>(`/members/${id}/reset-password`, { method: "POST" }),
};

export const teamApi = {
  list: (signal?: AbortSignal) =>
    request<{ items: TeamMember[] }>("/team", { signal }).then((d) => d.items),

  /** Create a librarian, or an administrator when `role` says so. */
  create: (input: CreateStaffMemberInput) =>
    request<{ member: TeamMember }>("/team", { method: "POST", body: input }).then((d) => d.member),

  /** Name and/or status. `role` is deliberately not accepted. */
  update: (id: string, input: { name?: string; status?: UserStatus }) =>
    request<{ member: TeamMember }>(`/team/${id}`, { method: "PATCH", body: input }).then(
      (d) => d.member,
    ),
};

export const categoriesApi = {
  list: (signal?: AbortSignal) =>
    request<{ items: CategorySummary[] }>("/categories", { signal }).then((d) => d.items),

  create: (input: CategoryInput) =>
    request<{ category: CategorySummary }>("/categories", { method: "POST", body: input }).then(
      (d) => d.category,
    ),

  update: (id: string, input: Partial<CategoryInput>) =>
    request<{ category: CategorySummary }>(`/categories/${id}`, { method: "PATCH", body: input }).then(
      (d) => d.category,
    ),

  remove: (id: string) =>
    request<{ id: string }>(`/categories/${id}`, { method: "DELETE" }),
};

/* -------------------------------------------------------------------------- */
/* Loans (spec 11)                                                             */
/* -------------------------------------------------------------------------- */

/** The per-row shape is one declaration, re-exported from `types/index.ts`. */
export type {
  LoanBookRef,
  LoanDisplayState,
  LoanFineRef,
  LoanMemberRef,
  LoanReturnResult,
  LoanSummary,
} from "@/types";

/** Mirrors `listLoansQuerySchema`. `status` is the *derived* view vocabulary. */
export type LoanListFilters = {
  q?: string;
  status?: LoanView;
  memberId?: string;
  bookId?: string;
  /** `YYYY-MM-DD`, inclusive. */
  from?: string;
  /** `YYYY-MM-DD`, inclusive. */
  to?: string;
  page?: number;
  limit?: number;
};

export type IssueLoanInput = {
  /** A member id. Role-checked by the service. */
  memberId: string;
  /** A book id **or** slug — the desk has a barcode or a title. */
  bookId: string;
  notes?: string;
};

export const loansApi = {
  /** Staff. One page of loans, with `meta` for pagination. */
  list: (filters: LoanListFilters = {}, signal?: AbortSignal) =>
    requestWithMeta<{ items: LoanSummary[] }>("/loans", { query: filters, signal }),

  /**
   * The signed-in user's own loans. Takes **no id** — the server resolves it from the
   * session, so a member cannot ask for someone else's loans by editing a URL.
   */
  mine: (filters: { status?: LoanView; page?: number; limit?: number } = {}, signal?: AbortSignal) =>
    requestWithMeta<{ items: LoanSummary[] }>("/loans/mine", { query: filters, signal }),

  issue: (input: IssueLoanInput) =>
    request<{ loan: LoanSummary }>("/loans/issue", { method: "POST", body: input }).then(
      (d) => d.loan,
    ),

  /**
   * Returns the loan and the fine it raised, so the desk can say so immediately.
   * `fine` is `null` until Unit 13 fills the hook in.
   */
  return: (loanId: string) =>
    request<LoanReturnResult>(`/loans/${loanId}/return`, { method: "POST" }),

  /** Staff on anyone's loan; a member on their own. 403 otherwise. */
  renew: (loanId: string) =>
    request<{ loan: LoanSummary }>(`/loans/${loanId}/renew`, { method: "POST" }).then((d) => d.loan),
};

/* -------------------------------------------------------------------------- */
/* Fines (spec 13)                                                             */
/* -------------------------------------------------------------------------- */

/** Wire shapes are declared once in `types/index.ts`; re-exported here for components. */
export type { FineListItem, FineSummary, FineTotals } from "@/types";

/** Mirrors `listFinesQuerySchema`. */
export type FineListFilters = {
  q?: string;
  status?: FineStatus;
  memberId?: string;
  bookId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type CollectFineInput = {
  paymentMethod: PaymentMethod;
  /** Must cover the outstanding amount; the service refuses a part payment. */
  amount: number;
  note?: string;
};

export const finesApi = {
  /** Staff. Returns the page **and** the three KPI totals. */
  list: (filters: FineListFilters = {}, signal?: AbortSignal) =>
    requestWithMeta<{ items: FineListItem[]; totals: FineTotals }>("/fines", {
      query: filters,
      signal,
    }),

  /**
   * The signed-in user's own fines. Takes **no id** — resolved from the session, so a
   * member cannot read someone else's by editing the URL.
   */
  mine: (
    filters: { status?: FineStatus; page?: number; limit?: number } = {},
    signal?: AbortSignal,
  ) =>
    requestWithMeta<{ items: FineListItem[]; outstandingTotal: number }>("/fines/mine", {
      query: filters,
      signal,
    }),

  /** `unpaid → paid`. A repeat attempt is a 400, not a silent no-op. */
  collect: (id: string, input: CollectFineInput) =>
    request<{ fine: FineListItem }>(`/fines/${id}/collect`, { method: "POST", body: input }).then(
      (d) => d.fine,
    ),

  /** `unpaid → waived`. A reason is required and stored on the document. */
  waive: (id: string, reason: string) =>
    request<{ fine: FineListItem }>(`/fines/${id}/waive`, {
      method: "POST",
      body: { reason },
    }).then((d) => d.fine),
};

/* -------------------------------------------------------------------------- */
/* Reservations (spec 14)                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Wire shapes are declared once in `types/index.ts`; re-exported here for components.
 * `MemberReservation` is already re-exported by the Members block above, which is where a
 * component that reads a member record imports it from.
 */
export type { MemberReservations, QueueEntry, QueueInfo, ReservationSummary } from "@/types";

/**
 * Mirrors `listReservationsQuerySchema`. `status` is a **list**, sent as one
 * comma-separated value (`?status=waiting,ready`) — which is what lets the staff History tab
 * ask for three closed states in one paginated request instead of three.
 */
export type ReservationListFilters = {
  status?: ReservationStatus[];
  bookId?: string;
  page?: number;
  limit?: number;
};

export const reservationsApi = {
  /** Staff. The register tabs and the per-book queue behind "View queue". */
  list: (filters: ReservationListFilters = {}, signal?: AbortSignal) =>
    requestWithMeta<{ items: ReservationSummary[] }>("/reservations", {
      query: {
        status: filters.status?.join(","),
        bookId: filters.bookId,
        page: filters.page,
        limit: filters.limit,
      },
      signal,
    }),

  /**
   * The signed-in user's own holds, already grouped ready / waiting / past.
   * Takes **no id** — the server resolves it from the session, so a member cannot read
   * someone else's queue by editing a URL.
   */
  mine: (signal?: AbortSignal) => request<MemberReservations>("/reservations/mine", { signal }),

  /** Join a queue. 201, or a 400 whose message names the rule that refused it. */
  reserve: (bookId: string) =>
    request<{ reservation: ReservationSummary }>("/reservations", {
      method: "POST",
      body: { bookId },
    }).then((d) => d.reservation),

  /** Own hold or, for staff, anyone's. Cancelling a `ready` hold frees the copy. */
  cancel: (id: string) =>
    request<{ reservation: ReservationSummary }>(`/reservations/${id}`, { method: "DELETE" }).then(
      (d) => d.reservation,
    ),

  /** Staff. Issues the book from a `ready` hold and closes it in one transaction. */
  fulfil: (id: string) =>
    request<{ reservation: ReservationSummary; loan: LoanSummary }>(
      `/reservations/${id}/fulfil`,
      { method: "POST" },
    ),
};

/* -------------------------------------------------------------------------- */
/* Wishlist & Reviews (spec 15)                                                */
/* -------------------------------------------------------------------------- */

/** Wire shapes are declared once in `types/index.ts`; re-exported here for components. */
export type {
  NotificationSummary,
  RatingSummary,
  ReviewListResult,
  ReviewSummary,
  WishlistItem,
} from "@/types";

export { NOTIFICATION_PRESENTATION } from "@/lib/notification-templates";

/** Mirrors `upsertReviewSchema`. `rating` is coerced server-side. */
export type ReviewInput = {
  rating: number;
  comment?: string;
};

export const wishlistApi = {
  /** The signed-in user's saved books. No id — resolved from the session. */
  list: (signal?: AbortSignal) => request<{ items: WishlistItem[] }>("/wishlist", { signal }).then((d) => d.items),

  /**
   * **Idempotent.** Saving a book that is already saved returns the existing row rather
   * than a conflict, because the heart is a toggle and a double-click must not strand the
   * member in a state they cannot get out of.
   */
  add: (bookId: string) =>
    request<{ item: WishlistItem }>("/wishlist", { method: "POST", body: { bookId } }).then(
      (d) => d.item,
    ),

  /** Idempotent too — unsaving a book that is not saved succeeds. */
  remove: (bookId: string) => request<{ id: string }>(`/wishlist/${bookId}`, { method: "DELETE" }),
};

export const reviewsApi = {
  /**
   * **Public.** Works signed out; `isMine` / `canModerate` are false for a visitor.
   * `mine` is the caller's own review on **any** page, so the composer can always edit it.
   */
  list: (bookId: string, page = 1, limit = 10, signal?: AbortSignal) =>
    requestWithMeta<ReviewListResult>(`/books/${bookId}/reviews`, {
      query: { page, limit },
      signal,
    }),

  /** Create **or** update the caller's own review — one endpoint, because one review. */
  upsert: (bookId: string, input: ReviewInput) =>
    request<{ review: ReviewSummary }>(`/books/${bookId}/reviews`, {
      method: "POST",
      body: input,
    }).then((d) => d.review),

  /** Own review, or anyone's as staff. Returns the book's recomputed rating summary. */
  remove: (reviewId: string) =>
    request<{ summary: RatingSummary }>(`/reviews/${reviewId}`, { method: "DELETE" }).then(
      (d) => d.summary,
    ),
};

/* -------------------------------------------------------------------------- */
/* Notifications (spec 16)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * **The fetcher takes no positional parameters.** SWR calls `fetcher(key)`, so a
 * `(signal?: AbortSignal)` first argument receives the **string cache key** and hands it to
 * `fetch` — `Failed to convert value to 'AbortSignal'`. This has bitten this codebase three
 * times now (Unit 08 books table, Unit 09 catalog, Unit 11 loans), so the cancellation is
 * hand-rolled and the signature is deliberately empty.
 */
export const notificationsApi = {
  /** `unreadOnly` drives the page's Unread tab. The badge count is always the whole inbox. */
  list: (
    filters: { unreadOnly?: boolean; page?: number; limit?: number } = {},
    signal?: AbortSignal,
  ) =>
    requestWithMeta<{ items: NotificationSummary[]; unreadCount: number }>("/notifications", {
      query: filters,
      signal,
    }),

  /** Idempotent - a second press on an already-read notification changes nothing. */
  markRead: (id: string) =>
    request<{ id: string }>(`/notifications/${id}/read`, { method: "POST" }),

  /** One `updateMany` server-side, so a large inbox clears in a single request. */
  markAllRead: () =>
    request<{ marked: number }>("/notifications/read-all", { method: "POST" }).then(
      (d) => d.marked,
    ),
};

/**
 * Maintenance counts, as reported by the job.
 *
 * Client-side because the "Run maintenance" button in Unit 19's Settings page will call it and
 * wants to show what the run did; the route is admin-or-cron only and this type keeps the
 * numbers honest rather than three `number`s at the call site.
 */
export type MaintenanceCounts = {
  expiredReservations: number;
  dueSoon: number;
  overdue: number;
};

export const maintenanceApi = {
  /** Admin session, or `x-cron-secret` from a scheduler. See `POST /api/maintenance/run`. */
  run: () =>
    request<{ counts: MaintenanceCounts; triggeredBy: "admin" | "cron" }>("/maintenance/run", {
      method: "POST",
    }),
};

/* -------------------------------------------------------------------------- */
/* Public settings (spec 12)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The display-safe policy subset. Declared here rather than reusing `SettingDoc`, because
 * this endpoint's whole contract is that it returns **less** than the settings singleton —
 * typing it as the full document would be an invitation to widen it.
 */
export type PublicPolicy = {
  libraryName: string;
  loanPeriodDays: number;
  maxActiveLoans: number;
  maxRenewals: number;
  /** Days a single renewal adds. Shown so the optimistic preview can match the server. */
  renewalExtensionDays: number;
  finePerDay: number;
  currencySymbol: string;
  reservationHoldHours: number;
};

export const settingsApi = {
  /** Public and unauthenticated. Used to render due dates and policy copy. */
  public: (signal?: AbortSignal) => request<PublicPolicy>("/settings/public", { signal }),
};

/* -------------------------------------------------------------------------- */
/* Shared response shapes used by later units                                  */
/* -------------------------------------------------------------------------- */

export type ListPayload<T> = {
  items: T[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
};

/* -------------------------------------------------------------------------- */
/* Reports & Audit (spec 18)                                                   */
/* -------------------------------------------------------------------------- */

export const reportsApi = {
  /**
   * **The fetcher takes no positional parameters.** SWR calls `fetcher(key)`, so a
   * `(signal?: AbortSignal)` first argument receives the **string cache key** and hands it to
   * `fetch` — `Failed to convert value to 'AbortSignal'`. This has bitten this codebase three
   * times now, so the cancellation is hand-rolled and the signature is deliberately empty.
   */
  get: (type: ReportType, filters: ReportFilters = {}) =>
    request<ReportResult>(`/reports/${type}`, { query: filters }),

  /**
   * The CSV download URL, built as a plain link rather than fetched.
   *
   * **`fetch` + `blob` would work and is worse.** A download has to carry the server's
   * `Content-Disposition` filename to the browser, and re-creating that filename in the browser
   * is how a file called `download` ends up on somebody's desktop. An `<a href>` lets the browser
   * do the whole round trip: it streams to disk, names the file from the header, and never loads
   * a 2 MB report into a tab's memory first.
   */
  csvUrl: (type: ReportType, filters: ReportFilters = {}) =>
    `/api/reports/${type}${buildQuery({ ...filters, format: "csv" })}`,
};

export const auditApi = {
  list: (filters: AuditFilters = {}) => request<AuditListResult>("/audit", { query: filters }),
};

/** Narrow an unknown thrown value into something safe to show a user. */
export function toErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export type { NextResponse };
