/**
 * @jest-environment node
 *
 * Tests for the shared `fetchWithBackoff` helper used by importer adapters.
 *
 * Verifies:
 *   - immediate success (no retry, no onRetry)
 *   - non-429 4xx pass-through (no retry)
 *   - retry on HTTP 429, HTTP 5xx, and network errors
 *   - exhaustion returns the last response (does not throw)
 *   - `Retry-After: <seconds>` overrides the configured `delayMs` schedule
 *   - `maxRetries` override caps total attempts
 *
 * The helper sleeps between attempts via `setTimeout`, so all tests use
 * Jest fake timers and `jest.runAllTimersAsync()` to advance the schedule
 * without real-time delays. We override `opts.delayMs` to a fixed value
 * to remove jitter from assertions.
 */

import { fetchWithBackoff } from '../fetch-with-backoff';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

// Build a minimal Response with the given status and (optional) headers.
// `Response` is available globally in Node 18+ (used by Next.js).
function makeResponse(status: number, headers?: Record<string, string>): Response {
  return new Response(null, { status, headers });
}

describe('fetchWithBackoff', () => {
  let fetchMock: FetchMock;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock = jest.fn();
    // Override global fetch with our mock.
    (globalThis as unknown as { fetch: FetchMock }).fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns immediately when the first attempt succeeds (200)', async () => {
    const ok = makeResponse(200);
    fetchMock.mockResolvedValueOnce(ok);
    const onRetry = jest.fn();

    const result = await fetchWithBackoff('https://example.test/', undefined, {
      delayMs: () => 10,
      onRetry,
    });

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('passes 4xx (non-429) responses through without retrying', async () => {
    const notFound = makeResponse(404);
    fetchMock.mockResolvedValueOnce(notFound);
    const onRetry = jest.fn();

    const result = await fetchWithBackoff('https://example.test/', undefined, {
      delayMs: () => 10,
      onRetry,
    });

    expect(result).toBe(notFound);
    expect(result.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries once on HTTP 429 and surfaces the eventual 200', async () => {
    const rateLimited = makeResponse(429);
    const ok = makeResponse(200);
    fetchMock.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(ok);
    const onRetry = jest.fn();

    const promise = fetchWithBackoff('https://example.test/', undefined, {
      delayMs: () => 10,
      onRetry,
    });

    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 0, status: 429, delayMs: 10 })
    );
  });

  it('retries once on HTTP 500 and surfaces the eventual 200', async () => {
    const serverErr = makeResponse(500);
    const ok = makeResponse(200);
    fetchMock.mockResolvedValueOnce(serverErr).mockResolvedValueOnce(ok);
    const onRetry = jest.fn();

    const promise = fetchWithBackoff('https://example.test/', undefined, {
      delayMs: () => 10,
      onRetry,
    });

    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 0, status: 500, delayMs: 10 })
    );
  });

  it('retries when fetch rejects with a network error, then succeeds', async () => {
    const networkErr = new TypeError('network down');
    const ok = makeResponse(200);
    fetchMock.mockRejectedValueOnce(networkErr).mockResolvedValueOnce(ok);
    const onRetry = jest.fn();

    const promise = fetchWithBackoff('https://example.test/', undefined, {
      delayMs: () => 10,
      onRetry,
    });

    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 0, delayMs: 10, cause: networkErr })
    );
    // For network errors there's no HTTP status to report.
    expect(onRetry.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('returns the last 5xx response when retries are exhausted (does not throw)', async () => {
    const errResponses = [
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
      makeResponse(500),
    ];
    for (const r of errResponses) fetchMock.mockResolvedValueOnce(r);
    const onRetry = jest.fn();

    const promise = fetchWithBackoff('https://example.test/', undefined, {
      delayMs: () => 10,
      onRetry,
    });

    await jest.runAllTimersAsync();
    const result = await promise;

    // Default maxRetries=4 → 5 total attempts.
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result).toBe(errResponses[4]);
    expect(result.status).toBe(500);
    // onRetry fires before each of the 4 retries (not after the last failure).
    expect(onRetry).toHaveBeenCalledTimes(4);
  });

  it('honours Retry-After (seconds) over the configured delayMs schedule', async () => {
    const rateLimited = makeResponse(429, { 'Retry-After': '1' });
    const ok = makeResponse(200);
    fetchMock.mockResolvedValueOnce(rateLimited).mockResolvedValueOnce(ok);
    const onRetry = jest.fn();

    const promise = fetchWithBackoff('https://example.test/', undefined, {
      // If the helper used the schedule we'd wait ~99 seconds; it should
      // instead use the 1000ms from Retry-After.
      delayMs: () => 99_999,
      onRetry,
    });

    // Yield once so the first fetch resolves and the sleep is scheduled.
    await Promise.resolve();
    await Promise.resolve();

    // Advance 999ms — not enough; second fetch should not have fired yet.
    await jest.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Crossing the 1000ms boundary triggers the second attempt.
    await jest.advanceTimersByTimeAsync(2);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(ok);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    // The onRetry payload reports the honoured 1000ms, not 99_999.
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 0, status: 429, delayMs: 1000 })
    );
  });

  it('respects a maxRetries override (maxRetries: 1 → 2 total attempts)', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500)).mockResolvedValueOnce(makeResponse(500));
    const onRetry = jest.fn();

    const promise = fetchWithBackoff('https://example.test/', undefined, {
      maxRetries: 1,
      delayMs: () => 10,
      onRetry,
    });

    await jest.runAllTimersAsync();
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(500);
    // Only one retry happened (after attempt 0).
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
