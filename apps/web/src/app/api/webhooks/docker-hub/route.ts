import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleDockerHubWebhook } from '@/lib/version';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SECRET_HEADER = 'x-tasknebula-docker-hub-secret';
const MAX_BODY_BYTES = 100_000;

function getWebhookSecret(): string | null {
  const secret = process.env.TASKNEBULA_DOCKER_HUB_WEBHOOK_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

function requireWebhookAuth(request: NextRequest): NextResponse | null {
  const secret = getWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'TASKNEBULA_DOCKER_HUB_WEBHOOK_SECRET is not configured.' },
      { status: 503 }
    );
  }

  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const presented =
    request.headers.get(SECRET_HEADER) ||
    (bearer.length > 0 ? bearer : null) ||
    request.nextUrl.searchParams.get('secret') ||
    '';

  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json(
      { error: 'Invalid or missing Docker Hub webhook secret.' },
      { status: 401 }
    );
  }

  return null;
}

/**
 * POST /api/webhooks/docker-hub
 *
 * Docker Hub repository webhook receiver for `neuraparse/tasknebula`. Configure
 * Docker Hub with a URL like:
 *
 *   https://<host>/api/webhooks/docker-hub?secret=<TASKNEBULA_DOCKER_HUB_WEBHOOK_SECRET>
 *
 * Docker Hub's webhook settings only require a destination URL, so query-param
 * auth is supported; callers that can set headers may also use
 * `x-tasknebula-docker-hub-secret` or `Authorization: Bearer ...`.
 */
export async function POST(request: NextRequest) {
  const denied = requireWebhookAuth(request);
  if (denied) return denied;

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: 'Docker Hub webhook payload is too large.' },
      { status: 413 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid Docker Hub webhook JSON.' }, { status: 400 });
  }

  const result = await handleDockerHubWebhook(payload);
  return NextResponse.json(result, { status: result.ok ? 202 : 400 });
}
