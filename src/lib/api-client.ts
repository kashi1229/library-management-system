import type { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/api";
import type { FieldErrors } from "@/lib/api";
import type { CloudinaryImage, PublicUser } from "@/types";

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

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  return payload.data;
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
