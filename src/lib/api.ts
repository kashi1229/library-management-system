import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType, type z } from "zod";
import { PAGINATION } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import type { PageMeta } from "@/types";

/* -------------------------------------------------------------------------- */
/* Error contract (architecture.md invariant 14)                               */
/* -------------------------------------------------------------------------- */

export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RULE_VIOLATION: 400,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

/** Field-level validation detail, rendered inline by forms. */
export type FieldErrors = Record<string, string>;

/**
 * The only error type services are expected to throw. The `handler` wrapper
 * turns it into the standard failure envelope; anything else becomes a generic
 * 500 so internals never leak to the client.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;

  constructor(code: ErrorCode, message: string, status?: number, fields?: FieldErrors) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status ?? ERROR_STATUS[code];
    this.fields = fields;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static unauthenticated(message = "You must be signed in.") {
    return new AppError("UNAUTHENTICATED", message);
  }

  static forbidden(message = "You do not have access to this resource.") {
    return new AppError("FORBIDDEN", message);
  }

  static notFound(message = "Not found.") {
    return new AppError("NOT_FOUND", message);
  }

  static conflict(message: string, fields?: FieldErrors) {
    return new AppError("CONFLICT", message, ERROR_STATUS.CONFLICT, fields);
  }

  /** A business rule (architecture.md §Business Rules) rejected the request. */
  static rule(message: string, fields?: FieldErrors) {
    return new AppError("RULE_VIOLATION", message, ERROR_STATUS.RULE_VIOLATION, fields);
  }

  static validation(message = "Please check the highlighted fields.", fields?: FieldErrors) {
    return new AppError("VALIDATION", message, ERROR_STATUS.VALIDATION, fields);
  }
}

/* -------------------------------------------------------------------------- */
/* Envelope                                                                    */
/* -------------------------------------------------------------------------- */

export type ApiSuccess<T> = { success: true; data: T; meta?: PageMeta };
export type ApiFailure = {
  success: false;
  error: { code: ErrorCode; message: string; fields?: FieldErrors };
};
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

/** 200 / 201 success envelope. */
export function ok<T>(data: T, meta?: PageMeta, status = 200): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json<ApiSuccess<T>>(
    meta ? { success: true, data, meta } : { success: true, data },
    { status },
  );
}

/** Failure envelope. Prefer throwing `AppError` and letting `handler` build this. */
export function fail(
  code: ErrorCode,
  message: string,
  fields?: FieldErrors,
): NextResponse<ApiFailure> {
  return NextResponse.json<ApiFailure>(
    { success: false, error: fields ? { code, message, fields } : { code, message } },
    { status: ERROR_STATUS[code] },
  );
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

function zodToFieldErrors(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    // Keep the first message per field so forms show one clear error.
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Parse and validate a JSON body. Throws a 422 `AppError` with field details. */
export async function parseBody<T extends ZodType>(schema: T, request: Request): Promise<z.infer<T>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw AppError.validation("Request body must be valid JSON.");
  }

  return parseWith(schema, raw);
}

/** Parse and validate URL search params (all values arrive as strings). */
export function parseQuery<T extends ZodType>(schema: T, request: Request): z.infer<T> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    // Repeated params collapse into the last value; no endpoint needs arrays here.
    raw[key] = value;
  });

  return parseWith(schema, raw);
}

/** Validate `params` for dynamic route segments (`await context.params`). */
export async function parseParams<T extends ZodType>(
  schema: T,
  params: Promise<Record<string, string>> | Record<string, string>,
): Promise<z.infer<T>> {
  const resolved = await params;
  return parseWith(schema, resolved);
}

function parseWith<T extends ZodType>(schema: T, raw: unknown): z.infer<T> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw AppError.validation("Please check the highlighted fields.", zodToFieldErrors(result.error));
  }
  return result.data;
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

/** Clamped `skip` / `limit` / `page` for a Mongo `find`. */
export function paginate(input?: { page?: number; limit?: number }): {
  skip: number;
  limit: number;
  page: number;
} {
  const page = Math.max(PAGINATION.defaultPage, Math.trunc(input?.page ?? PAGINATION.defaultPage));
  const requested = Math.trunc(input?.limit ?? PAGINATION.defaultLimit);
  const limit = Math.min(PAGINATION.maxLimit, Math.max(1, requested));

  return { skip: (page - 1) * limit, limit, page };
}

/** Build the `meta` block for a paginated response. */
export function buildMeta(total: number, page: number, limit: number): PageMeta {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Handler wrapper                                                             */
/* -------------------------------------------------------------------------- */

export type HandlerContext<P> = {
  /** Typed route params. Always a promise on Next 15+ (`await context.params`). */
  params: Promise<P>;
  request: Request;
};

export type HandlerOptions = {
  /** Human name used in server-side logs, e.g. `"POST /books"`. */
  name?: string;
  /**
   * Skip the automatic `connectDB()` for handlers that need no database
   * (for example a pure Cloudinary signature endpoint).
   */
  skipDb?: boolean;
};

export type RouteHandler<P = Record<string, string>> = (
  request: Request,
  context: { params: Promise<P> },
) => Promise<Response> | Response;

/** The callback shape a route author writes: request + `{ request, params }`. */
export type HandlerFn<P = Record<string, string>> = (
  request: Request,
  context: HandlerContext<P>,
) => Promise<Response> | Response;

/**
 * Wraps every route handler, in this exact order:
 *   1. `connectDB()`
 *   2. the handler body (auth → validate → one service call → respond)
 *   3. `AppError` → failure envelope; Zod errors → 422; anything else → 500
 *
 * Unknown errors are logged server-side with full context and reported to the
 * client as a generic message, so stack traces and driver text never leak.
 */
export function handler<P = Record<string, string>>(
  fn: HandlerFn<P>,
  options: HandlerOptions = {},
): RouteHandler<P> {
  return async (request, context) => {
    const label = options.name ?? `${request.method} ${new URL(request.url).pathname}`;

    try {
      if (!options.skipDb) await connectDB();
      return await fn(request, { params: context.params, request });
    } catch (error) {
      if (error instanceof AppError) {
        return fail(error.code, error.message, error.fields);
      }

      if (error instanceof ZodError) {
        return fail("VALIDATION", "Please check the highlighted fields.", zodToFieldErrors(error));
      }

      // Prisma-style / driver conflicts still deserve a clear 409.
      if (isDuplicateKeyError(error)) {
        return fail("CONFLICT", "That record already exists.");
      }

      console.error(`[api] Unhandled error in ${label}:`, error);
      return fail("INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

/** Mongo `E11000` duplicate key, raised by the partial-unique indexes. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
