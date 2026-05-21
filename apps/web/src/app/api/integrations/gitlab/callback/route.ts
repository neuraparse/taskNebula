/**
 * GET /api/integrations/gitlab/callback?code=...&state=...
 *
 * Validates state cookie, exchanges the authorization code for tokens at
 * GitLab, stores the encrypted tokens in integration_connections
 * (provider = 'gitlab'), and redirects back to the settings integrations tab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, integrationConnections } from '@tasknebula/db';
import { auth } from '@/auth';
import { encryptToken } from '@/lib/integrations/token-crypto';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const GITLAB_TOKEN_URL = 'https://gitlab.com/oauth/token';
const GITLAB_USER_URL = 'https://gitlab.com/api/v4/user';
const STATE_COOKIE = 'tn_gitlab_state';

interface StatePayload {
  n: string;
  o: string; // organizationId
  u: string; // userId
}

function decodeState(raw: string): StatePayload | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.n === 'string' &&
      typeof parsed?.o === 'string' &&
      typeof parsed?.u === 'string'
    ) {
      return parsed as StatePayload;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function settingsRedirect(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/settings', request.url);
  url.searchParams.set('tab', 'integrations');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return settingsRedirect(request, { integration: 'gitlab', error: errorParam });
  }
  if (!code || !state) {
    return settingsRedirect(request, { integration: 'gitlab', error: 'missing_code_or_state' });
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return settingsRedirect(request, { integration: 'gitlab', error: 'invalid_state' });
  }

  const decoded = decodeState(state);
  if (!decoded || decoded.u !== session.user.id) {
    return settingsRedirect(request, { integration: 'gitlab', error: 'invalid_state' });
  }

  const clientId = process.env.GITLAB_CLIENT_ID;
  const clientSecret = process.env.GITLAB_CLIENT_SECRET;
  const redirectUri = process.env.GITLAB_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return settingsRedirect(request, { integration: 'gitlab', error: 'oauth_not_configured' });
  }

  // Exchange the code for tokens.
  let tokenJson: {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
    created_at?: number;
  };
  try {
    const tokenRes = await fetch(GITLAB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
      cache: 'no-store',
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => '');
      console.error('GitLab token exchange failed', tokenRes.status, detail);
      return settingsRedirect(request, { integration: 'gitlab', error: 'token_exchange_failed' });
    }
    tokenJson = await tokenRes.json();
  } catch (err) {
    console.error('GitLab token exchange threw', err);
    return settingsRedirect(request, { integration: 'gitlab', error: 'token_exchange_failed' });
  }

  if (!tokenJson.access_token) {
    return settingsRedirect(request, { integration: 'gitlab', error: 'no_access_token' });
  }

  // Fetch user info for externalAccountId / label.
  let externalAccountId = '';
  let externalAccountLabel = '';
  try {
    const userRes = await fetch(GITLAB_USER_URL, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (userRes.ok) {
      const user = (await userRes.json()) as {
        id?: number | string;
        username?: string;
        name?: string;
      };
      if (user?.id !== undefined && user.id !== null) externalAccountId = String(user.id);
      externalAccountLabel = user?.username || user?.name || '';
    }
  } catch (err) {
    console.warn('GitLab /user lookup failed (non-fatal)', err);
  }

  const accessTokenEnc = encryptToken(tokenJson.access_token);
  const refreshTokenEnc = tokenJson.refresh_token ? encryptToken(tokenJson.refresh_token) : null;

  const metadata = {
    tokenType: tokenJson.token_type ?? null,
    expiresIn: tokenJson.expires_in ?? null,
    createdAt: tokenJson.created_at ?? null,
  };

  const now = new Date();
  const organizationId = decoded.o;

  if (!(await hasPermission(organizationId, 'org:settings'))) {
    return settingsRedirect(request, { integration: 'gitlab', error: 'forbidden' });
  }

  try {
    // Upsert: one connection per (organizationId, provider). If another
    // agent's schema includes a unique constraint this will collapse; if
    // not we still look up explicitly first.
    const existing = await db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, 'gitlab')
        )
      )
      .limit(1);

    const existingRow = existing[0];
    if (existingRow) {
      await db
        .update(integrationConnections)
        .set({
          externalAccountId,
          externalAccountLabel,
          accessTokenEnc,
          refreshTokenEnc,
          scope: tokenJson.scope ?? null,
          metadata,
          connectedById: session.user.id,
          updatedAt: now,
        })
        .where(eq(integrationConnections.id, existingRow.id));
    } else {
      await db.insert(integrationConnections).values({
        organizationId,
        provider: 'gitlab',
        externalAccountId,
        externalAccountLabel,
        accessTokenEnc,
        refreshTokenEnc,
        scope: tokenJson.scope ?? null,
        metadata,
        connectedById: session.user.id,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('Failed to persist GitLab integration_connection', err);
    return settingsRedirect(request, { integration: 'gitlab', error: 'persist_failed' });
  }

  const response = settingsRedirect(request, { integration: 'gitlab', connected: '1' });
  response.cookies.delete(STATE_COOKIE);
  return response;
}
