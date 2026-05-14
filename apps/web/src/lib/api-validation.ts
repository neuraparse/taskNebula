/**
 * Zod-validated wrapper for Next.js App Router Route Handlers.
 *
 * Goal: replace the ad-hoc `schema.parse(body) → try/catch ZodError → 400`
 * pattern duplicated across 194 API routes in `apps/web/src/app/api`.
 *
 * Usage:
 *
 *   const POST = withValidation({
 *     body: createIssueSchema,
 *     query: z.object({ projectId: id }),
 *     params: z.object({ issueId: id }),
 *   })(async (req, { body, query, params }) => {
 *     // body, query, params are fully typed from the supplied schemas.
 *     return NextResponse.json({ ok: true });
 *   });
 *
 * On validation failure, returns a 400 with a consistent error envelope:
 *
 *   { error: { code: "VALIDATION_FAILED", message, details: ZodIssue[] } }
 *
 * The error envelope intentionally mirrors the shape proposed in roadmap
 * task #6 (unified API error envelope). If #6 ships a shared helper later,
 * this module can be migrated to call it without changing the public API.
 *
 * Notes / design choices:
 * - Supports Next.js 15 Promise-based `params` (`{ params: Promise<...> }`).
 * - Passes `body: undefined` to GET / DELETE style handlers that don't
 *   declare a body schema, instead of trying to parse JSON.
 * - Does NOT enforce `.strict()` by default — Zod's default is `passthrough`-ish
 *   (unknown keys are stripped). Callers can opt into `.strict()` per schema
 *   when they want to reject unknown fields.
 * - Catches malformed JSON (`SyntaxError` from `request.json()`) and returns
 *   the same 400 envelope under code `INVALID_JSON`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodIssue, ZodSchema } from 'zod';

// --- Public types --------------------------------------------------------

export interface ValidationSchemas<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
  TParams extends ZodSchema | undefined = undefined,
> {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
}

export type Validated<T extends ZodSchema | undefined> = T extends ZodSchema
  ? z.infer<T>
  : undefined;

export interface ValidatedInput<
  TBody extends ZodSchema | undefined,
  TQuery extends ZodSchema | undefined,
  TParams extends ZodSchema | undefined,
> {
  body: Validated<TBody>;
  query: Validated<TQuery>;
  params: Validated<TParams>;
}

/**
 * Route context as Next.js 15 hands it to a Route Handler.
 * `params` is a Promise in Next 15 App Router.
 */
export interface RouteContext<TParamsRaw = Record<string, string | string[]>> {
  params: Promise<TParamsRaw>;
}

export type ValidatedHandler<
  TBody extends ZodSchema | undefined,
  TQuery extends ZodSchema | undefined,
  TParams extends ZodSchema | undefined,
> = (
  request: NextRequest,
  validated: ValidatedInput<TBody, TQuery, TParams>
) => Promise<Response> | Response;

// --- Error envelope ------------------------------------------------------

export const VALIDATION_ERROR_CODE = 'VALIDATION_FAILED' as const;
export const INVALID_JSON_ERROR_CODE = 'INVALID_JSON' as const;

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function validationErrorResponse(
  issues: ZodIssue[],
  message = 'Validation failed'
): NextResponse<ApiErrorEnvelope> {
  return NextResponse.json<ApiErrorEnvelope>(
    {
      error: {
        code: VALIDATION_ERROR_CODE,
        message,
        details: issues,
      },
    },
    { status: 400 }
  );
}

function invalidJsonResponse(): NextResponse<ApiErrorEnvelope> {
  return NextResponse.json<ApiErrorEnvelope>(
    {
      error: {
        code: INVALID_JSON_ERROR_CODE,
        message: 'Request body is not valid JSON',
      },
    },
    { status: 400 }
  );
}

// --- Helpers -------------------------------------------------------------

/**
 * Convert URLSearchParams into a plain object suitable for Zod parsing.
 *
 * Repeated keys become arrays (e.g. `?tag=a&tag=b` → `{ tag: ['a', 'b'] }`),
 * single keys stay scalar. Zod schemas can then declare `z.array(...)` or
 * `z.string()` per field as they expect. Use `z.coerce.number()` etc. to
 * coerce strings into numbers / booleans.
 */
export function searchParamsToObject(
  params: URLSearchParams
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : (all[0] ?? '');
  }
  return out;
}

// --- Main wrapper --------------------------------------------------------

/**
 * Build a Zod-validated Route Handler wrapper.
 *
 * Returns a function that takes your handler and produces a Next.js-compatible
 * Route Handler `(req, ctx) => Response`.
 */
export function withValidation<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined,
  TParams extends ZodSchema | undefined = undefined,
>(schemas: ValidationSchemas<TBody, TQuery, TParams>) {
  return function wrap(handler: ValidatedHandler<TBody, TQuery, TParams>) {
    return async function handleRequest(
      request: NextRequest,
      context?: RouteContext
    ): Promise<Response> {
      const issues: ZodIssue[] = [];

      // --- Params validation -----------------------------------------
      let parsedParams: unknown = undefined;
      if (schemas.params) {
        const rawParams = context ? await context.params : {};
        const result = schemas.params.safeParse(rawParams);
        if (!result.success) {
          issues.push(...prefixPath(result.error.issues, 'params'));
        } else {
          parsedParams = result.data;
        }
      }

      // --- Query validation ------------------------------------------
      let parsedQuery: unknown = undefined;
      if (schemas.query) {
        const obj = searchParamsToObject(request.nextUrl.searchParams);
        const result = schemas.query.safeParse(obj);
        if (!result.success) {
          issues.push(...prefixPath(result.error.issues, 'query'));
        } else {
          parsedQuery = result.data;
        }
      }

      // --- Body validation -------------------------------------------
      let parsedBody: unknown = undefined;
      if (schemas.body) {
        let rawBody: unknown;
        try {
          // Some requests (GET) may not have a body. `request.json()` throws
          // a JSON parse error on empty / invalid bodies; surface that as
          // INVALID_JSON. We check both the `SyntaxError` instance and the
          // name string because Next/undici sometimes wraps it in a TypeError
          // whose underlying cause is a SyntaxError.
          rawBody = await request.json();
        } catch (err) {
          if (isJsonParseError(err)) {
            return invalidJsonResponse();
          }
          throw err;
        }
        const result = schemas.body.safeParse(rawBody);
        if (!result.success) {
          issues.push(...prefixPath(result.error.issues, 'body'));
        } else {
          parsedBody = result.data;
        }
      }

      if (issues.length > 0) {
        return validationErrorResponse(issues);
      }

      return handler(request, {
        body: parsedBody as Validated<TBody>,
        query: parsedQuery as Validated<TQuery>,
        params: parsedParams as Validated<TParams>,
      });
    };
  };
}

/**
 * Prefix every issue path with a segment so callers can tell which input
 * a problem came from. E.g. `["title"]` → `["body", "title"]`.
 */
function prefixPath(issues: ZodIssue[], prefix: string): ZodIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: [prefix, ...issue.path],
  }));
}

/**
 * Detect a JSON parse failure regardless of how the runtime wraps it.
 * `request.json()` may throw SyntaxError directly or — in undici-based
 * runtimes — a TypeError whose `cause` is a SyntaxError.
 */
function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  if (typeof err === 'object' && err !== null) {
    const e = err as { name?: unknown; cause?: unknown; message?: unknown };
    if (e.name === 'SyntaxError') return true;
    if (e.cause instanceof SyntaxError) return true;
    if (
      typeof e.cause === 'object' &&
      e.cause !== null &&
      (e.cause as { name?: unknown }).name === 'SyntaxError'
    ) {
      return true;
    }
    if (
      typeof e.message === 'string' &&
      /JSON|Unexpected token/i.test(e.message)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Re-export ZodError so call sites can do `instanceof` checks without
 * pulling zod directly, if they don't already.
 */
export { ZodError };
