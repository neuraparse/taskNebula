/**
 * Typed API error hierarchy.
 *
 * All API route handlers should throw one of these instead of returning ad-hoc
 * `NextResponse.json({ error }, { status })`. `withErrorHandler` in
 * `./api-handler.ts` catches them and emits the standardised JSON envelope:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "...", "details"?: ... } }
 *
 * Each subclass has:
 *   - `status`  — HTTP status the handler should return
 *   - `code`    — stable machine-readable code (UPPER_SNAKE_CASE)
 *   - `message` — human-readable description
 *   - `details` — optional structured payload (e.g. Zod issues)
 *
 * Codes are intentionally stable: clients can branch on them without parsing
 * the message. Do not rename existing codes; add new subclasses instead.
 */

export interface ApiErrorOptions {
  /** Optional structured payload (e.g. validation issues). */
  details?: unknown;
  /** Underlying cause, attached for logging — never serialised to the client. */
  cause?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    options: ApiErrorOptions = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    if (options.cause !== undefined) {
      // Node's Error supports `cause` natively (ES2022) — assign defensively
      // since some test envs polyfill differently.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }

  /** JSON shape returned to clients. Does NOT include `cause`. */
  toJSON(): { code: string; message: string; details?: unknown } {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

/** 400 — request was syntactically valid but failed validation. */
export class ValidationError extends ApiError {
  constructor(message = 'Validation failed', options: ApiErrorOptions = {}) {
    super(400, 'VALIDATION_ERROR', message, options);
    this.name = 'ValidationError';
  }
}

/** 400 — generic bad request (use ValidationError when the payload schema is at fault). */
export class BadRequestError extends ApiError {
  constructor(message = 'Bad request', options: ApiErrorOptions = {}) {
    super(400, 'BAD_REQUEST', message, options);
    this.name = 'BadRequestError';
  }
}

/** 401 — caller is not authenticated. */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', options: ApiErrorOptions = {}) {
    super(401, 'UNAUTHORIZED', message, options);
    this.name = 'UnauthorizedError';
  }
}

/** 403 — caller is authenticated but lacks permission. */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', options: ApiErrorOptions = {}) {
    super(403, 'FORBIDDEN', message, options);
    this.name = 'ForbiddenError';
  }
}

/** 404 — resource not found. */
export class NotFoundError extends ApiError {
  constructor(message = 'Not found', options: ApiErrorOptions = {}) {
    super(404, 'NOT_FOUND', message, options);
    this.name = 'NotFoundError';
  }
}

/** 409 — request conflicts with current resource state. */
export class ConflictError extends ApiError {
  constructor(message = 'Conflict', options: ApiErrorOptions = {}) {
    super(409, 'CONFLICT', message, options);
    this.name = 'ConflictError';
  }
}

/** 429 — caller exceeded a rate limit. */
export class RateLimitError extends ApiError {
  /** Optional Retry-After seconds. Exposed via header by `withErrorHandler`. */
  readonly retryAfterSeconds?: number;
  constructor(
    message = 'Too many requests',
    options: ApiErrorOptions & { retryAfterSeconds?: number } = {},
  ) {
    super(429, 'RATE_LIMITED', message, options);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** Type guard. Useful when narrowing from `catch (e: unknown)`. */
export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
