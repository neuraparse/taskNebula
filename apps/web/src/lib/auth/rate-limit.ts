/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Not suitable for multi-instance deployments on its own — it only tracks
 * per-process state. Good enough to blunt casual abuse on auth endpoints
 * (forgot-password / reset-password) where the real backstop is SMTP rate
 * limits and single-use tokens. Swap for Redis/Upstash later.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  // Drop hits outside the current window.
  bucket.hits = bucket.hits.filter((t) => t > windowStart);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: Math.max(0, limit - bucket.hits.length),
    retryAfterMs: 0,
  };
}

/**
 * Derive a best-effort client IP from forwarding headers. NextRequest no
 * longer exposes `.ip` stably across runtimes, so we sniff the usual
 * proxy headers and fall back to a constant bucket.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
