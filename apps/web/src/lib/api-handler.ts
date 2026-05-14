/**
 * `withErrorHandler` — a higher-order wrapper for Next.js Route Handlers.
 *
 * Responsibilities:
 *   1. Catch thrown `ApiError`s and emit a standardised envelope:
 *        { error: { code, message, details? } }
 *      with the right HTTP status.
 *   2. Catch Zod errors (without coupling to zod's import) and convert them
 *      into a 400 with structured field details.
 *   3. Catch anything else, log at error level with the request id and stack,
 *      and return a generic 500 — never leak internal error messages.
 *   4. Attach `x-request-id` to the response (honouring the incoming header
 *      when present, otherwise generating one).
 *
 * Usage:
 *
 *   import { withErrorHandler } from "@/lib/api-handler";
 *   import { NotFoundError } from "@/lib/errors";
 *
 *   export const GET = withErrorHandler(async (req, ctx) => {
 *     const item = await getItem(ctx.params.id);
 *     if (!item) throw new NotFoundError("Item not found");
 *     return Response.json(item);
 *   }, { scope: "api/items/[id]" });
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ApiError, isApiError, RateLimitError, ValidationError } from './errors';
import { childLogger, logger as rootLogger, type Logger } from './logger';

export const REQUEST_ID_HEADER = 'x-request-id';

export interface WithErrorHandlerOptions {
  /** Scope passed to the child logger (e.g. "api/issues/[id]"). */
  scope?: string;
  /** Override logger (mainly for tests). */
  logger?: Logger;
}

export type RouteHandler<Ctx = unknown> = (
  request: NextRequest,
  context: Ctx,
) => Promise<Response> | Response;

/**
 * Generate a request id. Prefers `crypto.randomUUID` (Node 19+ / Edge), with a
 * deterministic-ish fallback for older runtimes.
 */
function generateRequestId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    try {
      return g.crypto.randomUUID();
    } catch {
      // fall through
    }
  }
  // Fallback: timestamp + random. Not cryptographically strong but unique enough
  // for log correlation in the unlikely event randomUUID isn't available.
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readRequestId(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  if (incoming && incoming.length > 0 && incoming.length <= 200) {
    return incoming;
  }
  return generateRequestId();
}

/**
 * Best-effort ZodError detector that works without importing zod here. We
 * compare the constructor name to avoid coupling this module to the zod
 * version pinned in the app. Falls back to `false` for anything else.
 */
function isZodError(
  err: unknown,
): err is { name: 'ZodError'; errors: unknown[]; issues?: unknown[] } {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'ZodError' &&
    Array.isArray((err as { errors?: unknown[] }).errors)
  );
}

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

function buildEnvelope(err: ApiError, requestId: string): ErrorEnvelope {
  const body: ErrorEnvelope = {
    error: {
      code: err.code,
      message: err.message,
    },
    requestId,
  };
  if (err.details !== undefined) {
    body.error.details = err.details;
  }
  return body;
}

function buildResponse(
  err: ApiError,
  requestId: string,
  extraHeaders?: Record<string, string>,
): NextResponse {
  const headers: Record<string, string> = {
    [REQUEST_ID_HEADER]: requestId,
    ...(extraHeaders || {}),
  };
  return NextResponse.json(buildEnvelope(err, requestId), {
    status: err.status,
    headers,
  });
}

/**
 * Wrap a Route Handler with standardised error handling.
 */
export function withErrorHandler<Ctx = unknown>(
  handler: RouteHandler<Ctx>,
  options: WithErrorHandlerOptions = {},
): RouteHandler<Ctx> {
  const log = options.logger
    ? options.logger.child({ scope: options.scope || 'api' })
    : options.scope
      ? childLogger(options.scope)
      : rootLogger.child({ scope: 'api' });

  return async function wrappedHandler(request, context) {
    const requestId = readRequestId(request);
    const startedAt = Date.now();

    try {
      const response = await handler(request, context);
      // Stamp the request id on successful responses too. Don't clobber if the
      // handler already set one (e.g. propagated from an upstream service).
      if (!response.headers.has(REQUEST_ID_HEADER)) {
        response.headers.set(REQUEST_ID_HEADER, requestId);
      }
      return response;
    } catch (err) {
      const durationMs = Date.now() - startedAt;

      // 1. Recognised API errors → return as-is, log at warn (4xx) or error (5xx).
      if (isApiError(err)) {
        const logPayload = {
          requestId,
          method: request.method,
          // Keep URL minimal — full URL may contain tokens in query strings.
          path: new URL(request.url).pathname,
          status: err.status,
          code: err.code,
          durationMs,
        };
        if (err.status >= 500) {
          log.error({ ...logPayload, err }, err.message);
        } else {
          log.warn(logPayload, err.message);
        }
        const extraHeaders =
          err instanceof RateLimitError && err.retryAfterSeconds !== undefined
            ? { 'retry-after': String(err.retryAfterSeconds) }
            : undefined;
        return buildResponse(err, requestId, extraHeaders);
      }

      // 2. Zod validation errors → 400 with field details.
      if (isZodError(err)) {
        const validation = new ValidationError('Validation failed', {
          details: err.errors,
        });
        log.warn(
          {
            requestId,
            method: request.method,
            path: new URL(request.url).pathname,
            status: 400,
            code: validation.code,
            durationMs,
            issues: err.errors,
          },
          'request validation failed',
        );
        return buildResponse(validation, requestId);
      }

      // 3. Unknown errors → 500, generic message, full stack in logs.
      log.error(
        {
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          status: 500,
          durationMs,
          err,
        },
        'unhandled error in route handler',
      );

      const fallback = new ApiError(
        500,
        'INTERNAL_ERROR',
        'An unexpected error occurred',
      );
      return buildResponse(fallback, requestId);
    }
  };
}

/** Convenience re-export so route files can `import { ... } from "@/lib/api-handler"` in one line. */
export { ApiError, ValidationError } from './errors';
