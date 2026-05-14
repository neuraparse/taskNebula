/**
 * @jest-environment node
 *
 * Unit tests for `withErrorHandler`.
 *
 * We verify:
 *   - happy path: response is returned untouched (but request id is stamped)
 *   - ApiError → standardised JSON envelope with the right status
 *   - ZodError (detected by name/errors duck-typing) → 400 with details
 *   - unknown error → 500 with generic message + INTERNAL_ERROR code
 *   - request id: honours incoming x-request-id, otherwise generates one
 *   - RateLimitError emits Retry-After header
 *   - injected silent logger so tests don't spam output
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ApiError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
} from '@/lib/errors';
import { REQUEST_ID_HEADER, withErrorHandler } from '@/lib/api-handler';
import pino from 'pino';

// Silent logger so tests stay quiet. We still pass a real Logger so `.child`
// chaining works inside the wrapper.
const silentLogger = pino({ level: 'silent' });

function makeRequest(url = 'http://localhost/api/test', init: RequestInit = {}): NextRequest {
  return new NextRequest(url, init);
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

describe('withErrorHandler', () => {
  it('returns the handler response unchanged and stamps a request id', async () => {
    const handler = withErrorHandler(
      async () => NextResponse.json({ ok: true }, { status: 200 }),
      { logger: silentLogger, scope: 'test' },
    );

    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ ok: true });
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it('honours an incoming x-request-id header', async () => {
    const handler = withErrorHandler(async () => NextResponse.json({ ok: true }), {
      logger: silentLogger,
    });

    const res = await handler(
      makeRequest('http://localhost/api/test', {
        headers: { [REQUEST_ID_HEADER]: 'req_abc_123' },
      }),
      {},
    );
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('req_abc_123');
  });

  it('does not overwrite a request id set by the handler', async () => {
    const handler = withErrorHandler(
      async () =>
        NextResponse.json(
          { ok: true },
          { headers: { [REQUEST_ID_HEADER]: 'upstream-id' } },
        ),
      { logger: silentLogger },
    );
    const res = await handler(makeRequest(), {});
    expect(res.headers.get(REQUEST_ID_HEADER)).toBe('upstream-id');
  });

  it('maps an ApiError to its status + envelope', async () => {
    const handler = withErrorHandler(
      async () => {
        throw new NotFoundError('Issue missing');
      },
      { logger: silentLogger },
    );

    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(404);
    const body = await readJson(res);
    expect(body).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Issue missing' },
      requestId: expect.any(String),
    });
    expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
  });

  it.each([
    [new UnauthorizedError(), 401, 'UNAUTHORIZED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new ConflictError(), 409, 'CONFLICT'],
  ])('maps %s to status %s with code %s', async (err, status, code) => {
    const handler = withErrorHandler(
      async () => {
        throw err;
      },
      { logger: silentLogger },
    );
    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(status);
    const body = await readJson(res);
    expect(body.error.code).toBe(code);
  });

  it('includes details from ApiError envelope', async () => {
    const handler = withErrorHandler(
      async () => {
        throw new ApiError(422, 'CUSTOM', 'nope', { details: { foo: 'bar' } });
      },
      { logger: silentLogger },
    );
    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(422);
    const body = await readJson(res);
    expect(body.error.details).toEqual({ foo: 'bar' });
  });

  it('attaches Retry-After header for RateLimitError', async () => {
    const handler = withErrorHandler(
      async () => {
        throw new RateLimitError('slow down', { retryAfterSeconds: 42 });
      },
      { logger: silentLogger },
    );
    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
  });

  it('maps a Zod-like error (duck-typed) to 400 with details', async () => {
    // We avoid importing zod here to keep this test isolated. The wrapper
    // detects ZodError by `name === "ZodError"` + array-shaped `errors`.
    const fakeZodError = Object.assign(new Error('Validation failed'), {
      name: 'ZodError',
      errors: [{ path: ['title'], message: 'Required' }],
    });

    const handler = withErrorHandler(
      async () => {
        throw fakeZodError;
      },
      { logger: silentLogger },
    );

    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toEqual([
      { path: ['title'], message: 'Required' },
    ]);
  });

  it('maps an unknown error to a generic 500 (no internal message leak)', async () => {
    const handler = withErrorHandler(
      async () => {
        throw new Error('db password is hunter2');
      },
      { logger: silentLogger },
    );
    const res = await handler(makeRequest(), {});
    expect(res.status).toBe(500);
    const body = await readJson(res);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    // The original message must not appear in the response body.
    expect(JSON.stringify(body)).not.toContain('hunter2');
  });

  it('forwards the route context to the inner handler', async () => {
    const inner = jest.fn(async () => NextResponse.json({}));
    const handler = withErrorHandler(inner, { logger: silentLogger });

    const ctx = { params: Promise.resolve({ id: 'iss_1' }) };
    await handler(makeRequest(), ctx);
    expect(inner).toHaveBeenCalledWith(expect.any(NextRequest), ctx);
  });
});
