/**
 * Token-bucket rate limiter with Redis (ioredis) backing and an in-memory
 * fallback. Used by user-facing AI endpoints (Ask TaskNebula RAG, future
 * /api/ai/* surfaces).
 *
 * Algorithm: classic fixed-window token bucket per { bucket, key }. The
 * Redis variant uses INCR + EXPIRE which is cheap, atomic enough for our
 * scale, and immune to clock drift between Node workers. When REDIS_URL is
 * not set we fall back to a process-local Map so dev environments and
 * single-node deployments still get rate limiting (just not cluster-wide).
 *
 * Default policy is 10 requests / 60s, matching the Ask endpoint's spec.
 * Callers can override `limit` / `windowSec` per-call if needed.
 */
import { getRedisClient, ensureRedisConnection } from './redis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Unix epoch seconds when the bucket resets. */
  resetAt: number;
  retryAfterSec: number;
  backend: 'redis' | 'memory';
}

export interface RateLimitOptions {
  /** Logical bucket name, e.g. 'ask'. Combined with `key` for the Redis key. */
  bucket: string;
  /** Per-user / per-IP discriminator. */
  key: string;
  /** Max requests allowed in the window. Default 10. */
  limit?: number;
  /** Window size in seconds. Default 60. */
  windowSec?: number;
}

// --- in-memory fallback -----------------------------------------------------

type MemoryBucket = { count: number; resetAt: number };
const memoryStore = new Map<string, MemoryBucket>();

function memoryConsume(
  fullKey: string,
  limit: number,
  windowSec: number
): RateLimitResult {
  const nowSec = Math.floor(Date.now() / 1000);
  const existing = memoryStore.get(fullKey);

  if (!existing || existing.resetAt <= nowSec) {
    const resetAt = nowSec + windowSec;
    memoryStore.set(fullKey, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetAt,
      retryAfterSec: 0,
      backend: 'memory',
    };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, existing.resetAt - nowSec),
      backend: 'memory',
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    limit,
    resetAt: existing.resetAt,
    retryAfterSec: 0,
    backend: 'memory',
  };
}

// --- Redis backend ----------------------------------------------------------

async function redisConsume(
  fullKey: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult | null> {
  const client = getRedisClient();
  if (!client) return null;

  try {
    await ensureRedisConnection(client);
  } catch {
    return null;
  }

  try {
    const pipeline = client.multi();
    pipeline.incr(fullKey);
    pipeline.ttl(fullKey);
    const replies = (await pipeline.exec()) as Array<[Error | null, unknown]> | null;
    if (!replies || replies.length < 2) return null;

    const [, countRaw] = replies[0]!;
    const [, ttlRaw] = replies[1]!;
    const count = Number(countRaw);
    let ttl = Number(ttlRaw);

    // First hit (or expired key after INCR): set TTL.
    if (ttl < 0) {
      await client.expire(fullKey, windowSec);
      ttl = windowSec;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const resetAt = nowSec + Math.max(0, ttl);

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        limit,
        resetAt,
        retryAfterSec: Math.max(1, ttl),
        backend: 'redis',
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      limit,
      resetAt,
      retryAfterSec: 0,
      backend: 'redis',
    };
  } catch {
    // Redis hiccup — degrade to in-memory rather than fail open.
    return null;
  }
}

// --- public API -------------------------------------------------------------

/**
 * Consume one token from the bucket. Returns `allowed: false` when the
 * limit has been exceeded; the caller should reply 429.
 */
export async function consumeRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const limit = options.limit ?? 10;
  const windowSec = options.windowSec ?? 60;
  const fullKey = `tn:rl:${options.bucket}:${options.key}`;

  const redisResult = await redisConsume(fullKey, limit, windowSec);
  if (redisResult) return redisResult;

  return memoryConsume(fullKey, limit, windowSec);
}

/** Internal helper exposed for tests — wipes the in-memory store. */
export function __resetRateLimitMemory() {
  memoryStore.clear();
}
