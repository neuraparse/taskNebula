import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  db,
  hasPermission as roleHasPermission,
  organizationMembers,
  users,
  type Permission,
} from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';

export type IntegrationOAuthProvider = 'github' | 'gitlab' | 'jira' | 'sentry' | 'slack';

export interface MobileIntegrationState {
  v: 1;
  kind: 'mobile-integration-oauth';
  provider: IntegrationOAuthProvider;
  organizationId: string;
  userId: string;
  nonce: string;
  exp: number;
}

const STATE_PREFIX = 'tnm1';
const STATE_TTL_MS = 10 * 60 * 1000;

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET or NEXTAUTH_SECRET is required for mobile OAuth state.');
  }
  return secret;
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signPayload(payload: string): string {
  return crypto.createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  try {
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function appOrigin(request: NextRequest): string {
  return new URL(request.url).origin;
}

export function createMobileIntegrationState(params: {
  provider: IntegrationOAuthProvider;
  organizationId: string;
  userId: string;
  now?: number;
}): string {
  const now = params.now ?? Date.now();
  const state: MobileIntegrationState = {
    v: 1,
    kind: 'mobile-integration-oauth',
    provider: params.provider,
    organizationId: params.organizationId,
    userId: params.userId,
    nonce: crypto.randomBytes(24).toString('base64url'),
    exp: now + STATE_TTL_MS,
  };
  const payload = base64urlJson(state);
  return `${STATE_PREFIX}.${payload}.${signPayload(payload)}`;
}

export function decodeMobileIntegrationState(
  raw: string,
  provider: IntegrationOAuthProvider,
  now = Date.now()
): MobileIntegrationState | null {
  const [prefix, payload, signature, extra] = raw.split('.');
  if (prefix !== STATE_PREFIX || !payload || !signature || extra) return null;
  if (!safeEqual(signPayload(payload), signature)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as Partial<MobileIntegrationState>;
    if (
      parsed.v !== 1 ||
      parsed.kind !== 'mobile-integration-oauth' ||
      parsed.provider !== provider ||
      typeof parsed.organizationId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < now
    ) {
      return null;
    }
    return parsed as MobileIntegrationState;
  } catch {
    return null;
  }
}

export function isMobileIntegrationState(raw: string | null | undefined): boolean {
  return typeof raw === 'string' && raw.startsWith(`${STATE_PREFIX}.`);
}

export function mobileIntegrationRedirect(
  request: NextRequest,
  params: {
    provider: IntegrationOAuthProvider;
    status: 'connected' | 'error';
    reason?: string;
  }
): NextResponse {
  const url = new URL('tasknebula://integrations/oauth');
  url.searchParams.set('provider', params.provider);
  url.searchParams.set('status', params.status);
  url.searchParams.set('server', appOrigin(request));
  if (params.reason) url.searchParams.set('reason', params.reason);
  return NextResponse.redirect(url.toString());
}

export async function hasPermissionForUser(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [member] = await db
    .select({ role: organizationMembers.role, status: organizationMembers.status })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  return roleHasPermission(
    member?.status === 'active' ? member.role || '' : '',
    permission,
    user?.isSuperAdmin || false
  );
}
