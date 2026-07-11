import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const TOKEN_TTL_MS = 60_000;
const SEEN_NONCES = new Map<string, number>();

export type MobileOAuthProvider = 'github' | 'google';

export type MobileOAuthExchangePayload = {
  v: 1;
  kind: 'mobile-oauth-exchange';
  userId: string;
  email: string;
  provider: MobileOAuthProvider;
  nonce: string;
  exp: number;
};

function secret(): Buffer {
  const raw = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!raw || raw.length < 16) {
    throw new Error('AUTH_SECRET is required to mint mobile OAuth exchange tokens.');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function pruneExpiredNonces(now = Date.now()) {
  for (const [nonce, exp] of SEEN_NONCES) {
    if (exp < now) SEEN_NONCES.delete(nonce);
  }
}

function sign(body: string): string {
  return crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  try {
    return crypto.timingSafeEqual(Buffer.from(left, 'base64url'), Buffer.from(right, 'base64url'));
  } catch {
    return false;
  }
}

function appOrigin(request: NextRequest): string {
  return new URL(request.url).origin;
}

export function normalizeMobileAuthCallbackUrl(
  callbackUrl: string | null | undefined,
  origin: string
): string | null {
  const value = callbackUrl?.trim();
  if (!value) return null;

  try {
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) return null;
    if (resolved.pathname === '/auth' || resolved.pathname.startsWith('/auth/')) return null;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export async function mintMobileOAuthExchangeToken(input: {
  userId: string;
  email: string;
  provider: MobileOAuthProvider;
  now?: number;
}): Promise<string> {
  const now = input.now ?? Date.now();
  const payload: MobileOAuthExchangePayload = {
    v: 1,
    kind: 'mobile-oauth-exchange',
    userId: input.userId,
    email: input.email.trim().toLowerCase(),
    provider: input.provider,
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: now + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

export async function consumeMobileOAuthExchangeToken(
  token: string,
  now = Date.now()
): Promise<MobileOAuthExchangePayload | null> {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(body))) return null;

  let payload: MobileOAuthExchangePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as MobileOAuthExchangePayload;
  } catch {
    return null;
  }

  if (
    payload.v !== 1 ||
    payload.kind !== 'mobile-oauth-exchange' ||
    !payload.userId ||
    !payload.email ||
    (payload.provider !== 'github' && payload.provider !== 'google') ||
    !payload.nonce ||
    payload.exp < now
  ) {
    return null;
  }

  pruneExpiredNonces(now);
  if (SEEN_NONCES.has(payload.nonce)) return null;
  SEEN_NONCES.set(payload.nonce, payload.exp);
  return payload;
}

export function mobileOAuthRedirect(
  request: NextRequest,
  params: {
    provider?: MobileOAuthProvider;
    status: 'authenticated' | 'error';
    token?: string;
    reason?: string;
    callbackUrl?: string | null;
  }
): NextResponse {
  const origin = appOrigin(request);
  const callbackUrl = normalizeMobileAuthCallbackUrl(params.callbackUrl, origin);
  const url = new URL('tasknebula://auth/oauth');
  url.searchParams.set('status', params.status);
  url.searchParams.set('server', origin);
  if (params.provider) url.searchParams.set('provider', params.provider);
  if (params.token) url.searchParams.set('token', params.token);
  if (params.reason) url.searchParams.set('reason', params.reason);
  if (callbackUrl) url.searchParams.set('callbackUrl', callbackUrl);
  return NextResponse.redirect(url.toString());
}
