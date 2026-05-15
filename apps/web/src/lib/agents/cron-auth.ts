/**
 * Shared helpers for cron route guards.
 *
 * Cron endpoints are protected by a shared secret passed in the
 * `x-cron-secret` header (or as `?secret=` for quick curl probes). The
 * secret is read from `CRON_SECRET`. When the env var is unset we refuse
 * the request to fail closed instead of silently exposing the endpoint.
 *
 * `timingSafeEqual` style compare so probing for the secret is harder.
 */
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const CRON_SECRET_HEADER = 'x-cron-secret';

export function getCronSecret(): string | null {
  const v = process.env.CRON_SECRET;
  return v && v.length >= 16 ? v : null;
}

/**
 * Returns null when the request is authorised. Returns a NextResponse to
 * short-circuit the route when it isn't.
 */
export function requireCronAuth(request: NextRequest): NextResponse | null {
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured on the server.' },
      { status: 503 }
    );
  }
  // Accept any of: `x-cron-secret` header, `Authorization: Bearer …` (so
  // schedulers that only allow a stock Authorization header still work),
  // or `?secret=` on the URL for quick curl probes. The first non-empty
  // value wins.
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const presented =
    request.headers.get(CRON_SECRET_HEADER) ||
    (bearer.length > 0 ? bearer : null) ||
    new URL(request.url).searchParams.get('secret') ||
    '';

  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  // `timingSafeEqual` requires equal-length buffers, so check length first.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid or missing cron secret.' }, { status: 401 });
  }
  return null;
}
