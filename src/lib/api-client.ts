import type { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { FieldErrors } from "@/lib/api";
import type { BookSort, BookAvailability, CategoryColor, LoanView, StaffRole, UserStatus } from "@/lib/constants";
import type { CategoryIconName } from "@/lib/validators/category";
import type { BookStatusFilter, PublicBookSort } from "@/lib/validators/book";
import type {
  BookDetail,
  BookSummary,
  CatalogBook,
  CatalogBookDetail,
  CatalogFacets,
  CloudinaryImage,
  MemberRecord,
  PageMeta,
  PublicUser,
} from "@/types";

// Loan wire shapes are **imported** (so this file can use them) and separately
// re-exported below for components. `export … from` alone does not bring a name into
// local scope, which is why both statements are needed.
import type { LoanReturnResult, LoanSummary } from "@/types";

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

/** Narrow an unknown thrown value into something safe to show a user. */
export function toErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export type { NextResponse };
