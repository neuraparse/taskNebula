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
import {
  decodeMobileIntegrationState,
  hasPermissionForUser,
  isMobileIntegrationState,
  mobileIntegrationRedirect,
} from '@/lib/integrations/mobile-oauth';

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
  const params = request.nextUrl.searchParams;
  const error = params.get('error');
  const rawState = params.get('state');
  const stateIsMobile = isMobileIntegrationState(rawState);
  const mobileState = rawState ? decodeMobileIntegrationState(rawState, JIRA_PROVIDER) : null;

  const session = mobileState ? null : await auth();
  if (!mobileState && !session?.user?.id) {
    return stateIsMobile
      ? mobileIntegrationRedirect(request, {
          provider: JIRA_PROVIDER,
          status: 'error',
          reason: 'invalid_state',
        })
      : redirectToSettings({ status: 'error', reason: 'unauthorized' });
  }

  const redirectResult = (message: { status: 'connected' | 'error'; reason?: string }) =>
    mobileState || stateIsMobile
      ? mobileIntegrationRedirect(request, {
          provider: JIRA_PROVIDER,
          status: message.status,
          reason: message.reason,
        })
      : redirectToSettings(message);

  if (error) {
    return redirectResult({ status: 'error', reason: error });
  }

  const code = params.get('code');
  if (!code || !rawState) {
    return redirectResult({ status: 'error', reason: 'missing_code_or_state' });
  }

  let organizationId: string;
  let userId: string;
  if (mobileState) {
    organizationId = mobileState.organizationId;
    userId = mobileState.userId;
    if (!(await hasPermissionForUser(userId, organizationId, 'org:settings'))) {
      return redirectResult({ status: 'error', reason: 'forbidden' });
    }
  } else {
    const state = decodeState(rawState);
    if (!state) {
      return redirectResult({ status: 'error', reason: 'bad_state' });
    }

    const cookieNonce = request.cookies.get(JIRA_STATE_COOKIE)?.value;
    if (!cookieNonce || cookieNonce !== state.nonce) {
      return redirectResult({ status: 'error', reason: 'state_mismatch' });
    }

    if (state.userId !== session?.user?.id) {
      return redirectResult({ status: 'error', reason: 'user_mismatch' });
    }

    if (!(await hasPermission(state.organizationId, 'org:settings'))) {
      return redirectResult({ status: 'error', reason: 'forbidden' });
    }
    organizationId = state.organizationId;
    userId = session.user.id;
  }

  let tokenResponse;
  try {
    tokenResponse = await exchangeJiraCode(code);
  } catch (err) {
    console.error('[jira] token exchange failed', err);
    return redirectResult({ status: 'error', reason: 'token_exchange_failed' });
  }

  let resources;
  try {
    resources = await fetchJiraAccessibleResources(tokenResponse.access_token);
  } catch (err) {
    console.error('[jira] accessible-resources failed', err);
    return redirectResult({ status: 'error', reason: 'accessible_resources_failed' });
  }

  const primaryResource = resources[0];
  if (!primaryResource) {
    return redirectResult({ status: 'error', reason: 'no_accessible_sites' });
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
      organizationId,
      provider: JIRA_PROVIDER,
      externalAccountId: primaryResource.id,
      externalAccountLabel: primaryResource.name,
      accessTokenEnc,
      refreshTokenEnc,
      scope,
      metadata,
      connectedById: userId,
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
        connectedById: userId,
        updatedAt: now,
      },
    });

  const response = redirectResult({ status: 'connected' });
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
