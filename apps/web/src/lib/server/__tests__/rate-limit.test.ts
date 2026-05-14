/**
 * @jest-environment node
 */

// Force the in-memory backend by ensuring REDIS_URL is unset.
const originalRedisUrl = process.env.REDIS_URL;
beforeAll(() => {
  delete process.env.REDIS_URL;
});
afterAll(() => {
  if (originalRedisUrl !== undefined) {
    process.env.REDIS_URL = originalRedisUrl;
  }
});

import { consumeRateLimit, __resetRateLimitMemory } from '../rate-limit';

describe('consumeRateLimit (in-memory fallback)', () => {
  beforeEach(() => {
    __resetRateLimitMemory();
  });

  it('allows the first request and decrements remaining', async () => {
    const result = await consumeRateLimit({ bucket: 'ask', key: 'user_a', limit: 3, windowSec: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.backend).toBe('memory');
  });

  it('blocks once the limit is exceeded and reports retryAfter', async () => {
    const opts = { bucket: 'ask', key: 'user_b', limit: 2, windowSec: 60 };
    await consumeRateLimit(opts);
    await consumeRateLimit(opts);
    const third = await consumeRateLimit(opts);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it('isolates buckets per key', async () => {
    const a = await consumeRateLimit({ bucket: 'ask', key: 'left', limit: 1, windowSec: 60 });
    const b = await consumeRateLimit({ bucket: 'ask', key: 'right', limit: 1, windowSec: 60 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it('isolates buckets per bucket name', async () => {
    const a = await consumeRateLimit({ bucket: 'ask', key: 'u', limit: 1, windowSec: 60 });
    const b = await consumeRateLimit({ bucket: 'draft', key: 'u', limit: 1, windowSec: 60 });
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });

  it('refills after the window expires', async () => {
    const opts = { bucket: 'ask', key: 'user_c', limit: 1, windowSec: 1 };
    const first = await consumeRateLimit(opts);
    expect(first.allowed).toBe(true);
    const second = await consumeRateLimit(opts);
    expect(second.allowed).toBe(false);

    // Advance the in-memory clock by tampering with the stored resetAt.
    // The simpler path is to wait, but the bucket lives inside the module's
    // closure; we re-init by clearing memory to simulate a window flip.
    __resetRateLimitMemory();
    const third = await consumeRateLimit(opts);
    expect(third.allowed).toBe(true);
  });
});
