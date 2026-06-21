import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, integrationConnections } from '@tasknebula/db';
import {
  JIRA_PROVIDER,
  JIRA_SCOPES,
  JIRA_STATE_COOKIE,
  exchangeJiraCode,
  fetchJiraAccessibleResources,
} from '@/lib/integrations/jira';
import { encryptToken } from '@/lib/integrations/token-crypto';
import { hasPermission } from '@/lib/auth/permissions';

type StatePayload = {
  nonce: string;
  organizationId: string;
  userId: string;
};

function decodeState(raw: string): StatePayload | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as Partial<StatePayload>;
    if (
      typeof parsed.nonce !== 'string' ||
      typeof parsed.organizationId !== 'string' ||
      typeof parsed.userId !== 'string'
    ) {
      return null;
    }
    return parsed as StatePayload;
  } catch {
    return null;
  }
}

function redirectToSettings(message?: { status: 'connected' | 'error'; reason?: string }) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';
  const url = new URL('/settings/integrations', base);
  if (message) {
    url.searchParams.set('jira', message.status);
    if (message.reason) url.searchParams.set('reason', message.reason);
  }
  return NextResponse.redirect(url.toString());
}

/**
 * GET /api/integrations/jira/callback
 *
 * Atlassian redirects the browser here with `?code=...&state=...`. We verify
 * the state cookie, exchange the code for tokens, fetch accessible resources
 * to identify the connected Jira site, and upsert an encrypted
 * `integration_connections` row with `provider='jira'`.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirectToSettings({ status: 'error', reason: 'unauthorized' });
  }

  const params = request.nextUrl.searchParams;
  const error = params.get('error');
  if (error) {
    return redirectToSettings({ status: 'error', reason: error });
  }

  const code = params.get('code');
  const rawState = params.get('state');
  if (!code || !rawState) {
    return redirectToSettings({ status: 'error', reason: 'missing_code_or_state' });
  }

  const state = decodeState(rawState);
  if (!state) {
    return redirectToSettings({ status: 'error', reason: 'bad_state' });
  }

  const cookieNonce = request.cookies.get(JIRA_STATE_COOKIE)?.value;
  if (!cookieNonce || cookieNonce !== state.nonce) {
    return redirectToSettings({ status: 'error', reason: 'state_mismatch' });
  }

  if (state.userId !== session.user.id) {
    return redirectToSettings({ status: 'error', reason: 'user_mismatch' });
  }

  if (!(await hasPermission(state.organizationId, 'org:settings'))) {
    return redirectToSettings({ status: 'error', reason: 'forbidden' });
  }

  let tokenResponse;
  try {
    tokenResponse = await exchangeJiraCode(code);
  } catch (err) {
    console.error('[jira] token exchange failed', err);
    return redirectToSettings({ status: 'error', reason: 'token_exchange_failed' });
  }

  let resources;
  try {
    resources = await fetchJiraAccessibleResources(tokenResponse.access_token);
  } catch (err) {
    console.error('[jira] accessible-resources failed', err);
    return redirectToSettings({ status: 'error', reason: 'accessible_resources_failed' });
  }

  const primaryResource = resources[0];
  if (!primaryResource) {
    return redirectToSettings({ status: 'error', reason: 'no_accessible_sites' });
  }

  const accessTokenEnc = encryptToken(tokenResponse.access_token);
  const refreshTokenEnc = tokenResponse.refresh_token
    ? encryptToken(tokenResponse.refresh_token)
    : null;

  const scope = tokenResponse.scope ?? JIRA_SCOPES.join(' ');
  const now = new Date();
  const metadata: Record<string, unknown> = {
    cloudId: primaryResource.id,
    siteUrl: primaryResource.url,
    siteName: primaryResource.name,
    availableSites: resources.map((r) => ({
      cloudId: r.id,
      url: r.url,
      name: r.name,
    })),
    grantedScopes: primaryResource.scopes ?? null,
    tokenType: tokenResponse.token_type ?? 'Bearer',
    expiresInSeconds: tokenResponse.expires_in ?? null,
    // Absolute expiry if the provider returned one — callers can compare to
    // Date.now() to decide whether to refresh.
    accessTokenExpiresAt: tokenResponse.expires_in
      ? new Date(now.getTime() + tokenResponse.expires_in * 1000).toISOString()
      : null,
    connectedAt: now.toISOString(),
  };

  await db
    .insert(integrationConnections)
    .values({
      organizationId: state.organizationId,
      provider: JIRA_PROVIDER,
      externalAccountId: primaryResource.id,
      externalAccountLabel: primaryResource.name,
      accessTokenEnc,
      refreshTokenEnc,
      scope,
      metadata,
      connectedById: session.user.id,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [integrationConnections.organizationId, integrationConnections.provider],
      set: {
        externalAccountId: primaryResource.id,
        externalAccountLabel: primaryResource.name,
        accessTokenEnc,
        refreshTokenEnc,
        scope,
        metadata,
        connectedById: session.user.id,
        updatedAt: now,
      },
    });

  const response = redirectToSettings({ status: 'connected' });
  // Invalidate the single-use state cookie.
  response.cookies.set(JIRA_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
