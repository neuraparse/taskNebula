/**
 * Redis-backed token bucket for the public intake endpoint.
 *
 * Falls back to the in-memory rate limiter when Redis is not configured
 * (tests, dev, single-node deployments without a cache). The bucket is
 * keyed by `<formId>:<ipHash>` so each (form, ip) pair gets its own
 * allowance independent of other forms or other submitters.
 */
import { getRedisClient, ensureRedisConnection } from '@/lib/server/redis';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export interface IntakeRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface IntakeRateLimitOptions {
  // Maximum submissions allowed inside `windowMs`.
  limit: number;
  // Sliding window length in milliseconds.
  windowMs: number;
  // Redis client override — primarily for tests.
  redis?: ReturnType<typeof getRedisClient> | null;
}

/**
 * Token bucket via Redis INCR + PEXPIRE. Equivalent to a fixed window
 * counter, which is fine for spam-blunting (the bucket is small and
 * resets cheaply). For multi-second bursts you'd want a real sliding
 * window, but for intake forms one bucket per window is sufficient.
 */
export async function checkIntakeRateLimit(
  key: string,
  options: IntakeRateLimitOptions,
): Promise<IntakeRateLimitResult> {
  const { limit, windowMs } = options;
  const redis = options.redis === undefined ? getRedisClient() : options.redis;

  if (!redis) {
    // No Redis: fall back to per-process sliding window.
    const result = checkRateLimit(`intake:${key}`, limit, windowMs);
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterMs: result.retryAfterMs,
    };
  }

  try {
    await ensureRedisConnection(redis);
    const redisKey = `intake:rl:${key}`;
    const current = await redis.incr(redisKey);
    if (current === 1) {
      // Newly created bucket — set TTL so it cleans up automatically.
      await redis.pexpire(redisKey, windowMs);
    }

    if (current > limit) {
      const ttl = await redis.pttl(redisKey);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: ttl > 0 ? ttl : windowMs,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - current),
      retryAfterMs: 0,
    };
  } catch (err) {
    // If Redis blows up we'd rather degrade open than block legitimate
    // submissions. The downstream issue creation still happens, so abuse
    // is still bounded by upstream protections.
    console.error('intake rate limit redis failed; falling open', err);
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }
}
