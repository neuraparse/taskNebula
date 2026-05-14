/**
 * @jest-environment node
 *
 * Unit tests for the typed API error hierarchy.
 *
 * We test:
 *   - default status/code/message for each subclass
 *   - constructor overrides (custom message, details, cause)
 *   - `toJSON` shape (no leakage of `cause` or stack)
 *   - `isApiError` type guard
 *   - prototype chain (instanceof checks all work, important for catch blocks)
 */

import {
  ApiError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  isApiError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from '@/lib/errors';

describe('ApiError hierarchy', () => {
  describe('defaults', () => {
    const cases: Array<{
      name: string;
      build: () => ApiError;
      status: number;
      code: string;
    }> = [
      { name: 'ValidationError', build: () => new ValidationError(), status: 400, code: 'VALIDATION_ERROR' },
      { name: 'BadRequestError', build: () => new BadRequestError(), status: 400, code: 'BAD_REQUEST' },
      { name: 'UnauthorizedError', build: () => new UnauthorizedError(), status: 401, code: 'UNAUTHORIZED' },
      { name: 'ForbiddenError', build: () => new ForbiddenError(), status: 403, code: 'FORBIDDEN' },
      { name: 'NotFoundError', build: () => new NotFoundError(), status: 404, code: 'NOT_FOUND' },
      { name: 'ConflictError', build: () => new ConflictError(), status: 409, code: 'CONFLICT' },
      { name: 'RateLimitError', build: () => new RateLimitError(), status: 429, code: 'RATE_LIMITED' },
    ];

    test.each(cases)('$name has status $status and code $code', ({ build, status, code }) => {
      const err = build();
      expect(err).toBeInstanceOf(ApiError);
      expect(err).toBeInstanceOf(Error);
      expect(err.status).toBe(status);
      expect(err.code).toBe(code);
      expect(typeof err.message).toBe('string');
      expect(err.message.length).toBeGreaterThan(0);
    });
  });

  it('accepts a custom message and structured details', () => {
    const issues = [{ path: ['title'], message: 'required' }];
    const err = new ValidationError('Title required', { details: issues });
    expect(err.message).toBe('Title required');
    expect(err.details).toEqual(issues);
  });

  it('preserves cause without serialising it in toJSON', () => {
    const cause = new Error('db down');
    const err = new ApiError(503, 'SERVICE_UNAVAILABLE', 'db down', { cause });
    expect((err as { cause?: unknown }).cause).toBe(cause);
    expect(err.toJSON()).toEqual({
      code: 'SERVICE_UNAVAILABLE',
      message: 'db down',
    });
  });

  it('toJSON omits details when undefined and includes them otherwise', () => {
    const a = new NotFoundError('Issue missing');
    expect(a.toJSON()).toEqual({ code: 'NOT_FOUND', message: 'Issue missing' });

    const b = new ValidationError('bad', { details: { field: 'x' } });
    expect(b.toJSON()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'bad',
      details: { field: 'x' },
    });
  });

  it('RateLimitError exposes retryAfterSeconds', () => {
    const err = new RateLimitError('Slow down', { retryAfterSeconds: 30 });
    expect(err.retryAfterSeconds).toBe(30);
    expect(err.status).toBe(429);
  });

  describe('isApiError guard', () => {
    it('returns true for subclasses', () => {
      expect(isApiError(new NotFoundError())).toBe(true);
      expect(isApiError(new ForbiddenError())).toBe(true);
    });

    it('returns false for plain errors and other values', () => {
      expect(isApiError(new Error('nope'))).toBe(false);
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
      expect(isApiError('string')).toBe(false);
      expect(isApiError({ status: 404, code: 'NOT_FOUND' })).toBe(false);
    });
  });

  it('all subclasses are catchable as ApiError', () => {
    function throwOne(): never {
      throw new ConflictError('dup');
    }
    expect.assertions(2);
    try {
      throwOne();
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictError);
      expect(e).toBeInstanceOf(ApiError);
    }
  });
});
