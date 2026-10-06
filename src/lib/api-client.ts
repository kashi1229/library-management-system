import type { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { FieldErrors } from "@/lib/api";
import type { BookSort, CategoryColor } from "@/lib/constants";
import type { CategoryIconName } from "@/lib/validators/category";
import type { BookStatusFilter } from "@/lib/validators/book";
import type { BookDetail, BookSummary, CloudinaryImage, PageMeta, PublicUser } from "@/types";

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
