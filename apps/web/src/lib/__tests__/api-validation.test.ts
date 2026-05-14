/**
 * @jest-environment node
 *
 * Tests for the withValidation wrapper.
 *
 * Covers:
 *  - valid body → handler is invoked with parsed/typed data
 *  - invalid body type → 400 VALIDATION_FAILED with details
 *  - missing required field → 400 with path pointing to the field
 *  - extra fields are stripped by default; .strict() rejects them
 *  - .passthrough() preserves extra fields verbatim
 *  - query coercion via z.coerce.number works
 *  - params (Next 15 Promise form) are validated
 *  - malformed JSON returns INVALID_JSON
 *  - body+query+params can be combined; errors are scoped by path prefix
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  withValidation,
  VALIDATION_ERROR_CODE,
  INVALID_JSON_ERROR_CODE,
  searchParamsToObject,
} from '@/lib/api-validation';

function makeRequest(
  url: string,
  init?: RequestInit & { jsonBody?: unknown }
): NextRequest {
  const { jsonBody, ...rest } = init ?? {};
  const body = jsonBody !== undefined ? JSON.stringify(jsonBody) : rest.body;
  return new NextRequest(url, {
    ...rest,
    body: body as BodyInit | undefined,
    headers: {
      'content-type': 'application/json',
      ...(rest.headers ?? {}),
    },
  });
}

describe('withValidation — body', () => {
  const schema = z.object({
    title: z.string().min(1),
    count: z.number().int().nonnegative(),
  });

  it('passes parsed body to the handler on success', async () => {
    const handler = jest.fn(async (_req, ctx) => {
      return Response.json({ ok: true, received: ctx.body });
    });

    const route = withValidation({ body: schema })(handler);
    const req = makeRequest('http://localhost/api/x', {
      method: 'POST',
      jsonBody: { title: 'hello', count: 3 },
    });

    const res = await route(req);
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    const arg = handler.mock.calls[0]![1];
    expect(arg.body).toEqual({ title: 'hello', count: 3 });
    expect(arg.query).toBeUndefined();
    expect(arg.params).toBeUndefined();
  });

  it('returns 400 VALIDATION_FAILED on wrong type', async () => {
    const handler = jest.fn();
    const route = withValidation({ body: schema })(handler);

    const req = makeRequest('http://localhost/api/x', {
      method: 'POST',
      jsonBody: { title: 'hello', count: 'not-a-number' },
    });

    const res = await route(req);
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();

    const json = (await res.json()) as any;
    expect(json.error.code).toBe(VALIDATION_ERROR_CODE);
    expect(json.error.message).toBe('Validation failed');
    expect(Array.isArray(json.error.details)).toBe(true);
    expect(json.error.details[0].path).toEqual(['body', 'count']);
  });

  it('returns 400 when a required field is missing', async () => {
    const handler = jest.fn();
    const route = withValidation({ body: schema })(handler);

    const req = makeRequest('http://localhost/api/x', {
      method: 'POST',
      jsonBody: { count: 1 },
    });

    const res = await route(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.details[0].path).toEqual(['body', 'title']);
  });

  it('strips extra fields by default', async () => {
    const handler = jest.fn(async (_req, ctx) =>
      Response.json({ received: ctx.body })
    );
    const route = withValidation({ body: schema })(handler);

    const req = makeRequest('http://localhost/api/x', {
      method: 'POST',
      jsonBody: { title: 't', count: 1, extra: 'should-be-stripped' },
    });

    const res = await route(req);
    expect(res.status).toBe(200);
    const arg = handler.mock.calls[0]![1];
    expect(arg.body).toEqual({ title: 't', count: 1 });
    expect((arg.body as any).extra).toBeUndefined();
  });

  it('rejects extra fields when schema is .strict()', async () => {
    const handler = jest.fn();
    const strict = schema.strict();
    const route = withValidation({ body: strict })(handler);

    const req = makeRequest('http://localhost/api/x', {
      method: 'POST',
      jsonBody: { title: 't', count: 1, extra: 'nope' },
    });

    const res = await route(req);
    expect(res.status).toBe(400);
    expect(handler).not.toHaveBeenCalled();
    const json = (await res.json()) as any;
    expect(json.error.code).toBe(VALIDATION_ERROR_CODE);
    // Zod emits an unrecognized_keys issue for strict objects.
    expect(json.error.details.some((d: any) => d.code === 'unrecognized_keys')).toBe(
      true
    );
  });

  it('preserves extra fields when schema is .passthrough()', async () => {
    const handler = jest.fn(async (_req, ctx) =>
      Response.json({ received: ctx.body })
    );
    const passthrough = schema.passthrough();
    const route = withValidation({ body: passthrough })(handler);

    const req = makeRequest('http://localhost/api/x', {
      method: 'POST',
      jsonBody: { title: 't', count: 1, extra: 'kept' },
    });

    const res = await route(req);
    expect(res.status).toBe(200);
    const arg = handler.mock.calls[0]![1];
    expect((arg.body as any).extra).toBe('kept');
  });

  it('returns INVALID_JSON when body is not valid JSON', async () => {
    const handler = jest.fn();
    const route = withValidation({ body: schema })(handler);

    const req = new NextRequest('http://localhost/api/x', {
      method: 'POST',
      body: 'not-json{{',
      headers: { 'content-type': 'application/json' },
    });

    const res = await route(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe(INVALID_JSON_ERROR_CODE);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('withValidation — query', () => {
  const querySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().optional(),
  });

  it('parses and coerces query params', async () => {
    const handler = jest.fn(async (_req, ctx) =>
      Response.json({ q: ctx.query })
    );
    const route = withValidation({ query: querySchema })(handler);

    const req = makeRequest('http://localhost/api/x?limit=10&cursor=abc', {
      method: 'GET',
    });

    const res = await route(req);
    expect(res.status).toBe(200);
    const arg = handler.mock.calls[0]![1];
    expect(arg.query).toEqual({ limit: 10, cursor: 'abc' });
  });

  it('rejects out-of-range query values', async () => {
    const handler = jest.fn();
    const route = withValidation({ query: querySchema })(handler);

    const req = makeRequest('http://localhost/api/x?limit=999', {
      method: 'GET',
    });

    const res = await route(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.code).toBe(VALIDATION_ERROR_CODE);
    expect(json.error.details[0].path).toEqual(['query', 'limit']);
  });
});

describe('withValidation — params', () => {
  const paramsSchema = z.object({ id: z.string().min(8) });

  it('validates Next 15 Promise-based params', async () => {
    const handler = jest.fn(async (_req, ctx) =>
      Response.json({ id: (ctx.params as any).id })
    );
    const route = withValidation({ params: paramsSchema })(handler);

    const req = makeRequest('http://localhost/api/x/abc12345', {
      method: 'GET',
    });

    const res = await route(req, {
      params: Promise.resolve({ id: 'abc12345' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe('abc12345');
  });

  it('rejects invalid params', async () => {
    const handler = jest.fn();
    const route = withValidation({ params: paramsSchema })(handler);

    const req = makeRequest('http://localhost/api/x/short', {
      method: 'GET',
    });

    const res = await route(req, {
      params: Promise.resolve({ id: 'short' }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    expect(json.error.details[0].path).toEqual(['params', 'id']);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('withValidation — combined', () => {
  it('reports errors from multiple inputs in one response', async () => {
    const handler = jest.fn();
    const route = withValidation({
      body: z.object({ title: z.string().min(1) }),
      query: z.object({ limit: z.coerce.number().int().min(1) }),
      params: z.object({ id: z.string().min(4) }),
    })(handler);

    const req = makeRequest('http://localhost/api/x?limit=0', {
      method: 'POST',
      jsonBody: { title: '' },
    });

    const res = await route(req, { params: Promise.resolve({ id: 'no' }) });
    expect(res.status).toBe(400);
    const json = (await res.json()) as any;
    const prefixes = json.error.details.map((d: any) => d.path[0]);
    expect(prefixes).toEqual(expect.arrayContaining(['params', 'query', 'body']));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('searchParamsToObject', () => {
  it('returns scalars for single keys and arrays for repeated keys', () => {
    const p = new URLSearchParams('a=1&b=2&b=3&c=');
    expect(searchParamsToObject(p)).toEqual({
      a: '1',
      b: ['2', '3'],
      c: '',
    });
  });
});
