/**
 * GET /api/integrations/github/callback?code=...&state=...
 *
 * GitHub redirects here after the user approves the OAuth app. We verify the
 * CSRF state cookie, exchange the code for an access token, fetch user info
 * for the externalAccount label, and upsert one row into
 * `integration_connections` keyed on (organization, 'github').
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, integrationConnections } from '@tasknebula/db';
import { auth } from '@/auth';
import { encryptToken } from '@/lib/integrations/token-crypto';
import { hasPermission } from '@/lib/auth/permissions';
import {
  GITHUB_STATE_COOKIE,
  exchangeGithubCode,
  fetchGithubUser,
} from '@/lib/integrations/github';

export const dynamic = 'force-dynamic';

interface StatePayload {
  n: string;
  o: string;
  u: string;
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
    // fall through
  }
  return null;
}

function settingsRedirect(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/settings/integrations', request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = NextResponse.redirect(url.toString());
  response.cookies.delete(GITHUB_STATE_COOKIE);
  return response;
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
    return settingsRedirect(request, { integration: 'github', error: errorParam });
  }
  if (!code || !state) {
    return settingsRedirect(request, {
      integration: 'github',
      error: 'missing_code_or_state',
    });
  }

  const cookieState = request.cookies.get(GITHUB_STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return settingsRedirect(request, {
      integration: 'github',
      error: 'invalid_state',
    });
  }

  const decoded = decodeState(state);
  if (!decoded || decoded.u !== session.user.id) {
    return settingsRedirect(request, {
      integration: 'github',
      error: 'invalid_state',
    });
  }

  if (!(await hasPermission(decoded.o, 'org:settings'))) {
    return settingsRedirect(request, {
      integration: 'github',
      error: 'forbidden',
    });
  }

  let tokenJson;
  try {
    tokenJson = await exchangeGithubCode(code);
  } catch (err) {
    console.error('GitHub token exchange threw', err);
    return settingsRedirect(request, {
      integration: 'github',
      error: 'token_exchange_failed',
    });
  }

  if (tokenJson.error || !tokenJson.access_token) {
    console.error('GitHub OAuth rejected', tokenJson.error, tokenJson.error_description);
    return settingsRedirect(request, {
      integration: 'github',
      error: tokenJson.error || 'no_access_token',
    });
  }

  // Fetch user info for the connection label. Failures are non-fatal — a
  // working token without a label is still useful.
  const user = await fetchGithubUser(tokenJson.access_token);
  const externalAccountId = user?.id != null ? String(user.id) : '';
  const externalAccountLabel = user?.login || user?.name || '';

  const accessTokenEnc = encryptToken(tokenJson.access_token);
  const refreshTokenEnc = tokenJson.refresh_token ? encryptToken(tokenJson.refresh_token) : null;

  const metadata = {
    tokenType: tokenJson.token_type ?? null,
    expiresIn: tokenJson.expires_in ?? null,
    refreshTokenExpiresIn: tokenJson.refresh_token_expires_in ?? null,
    avatarUrl: user?.avatar_url ?? null,
    connectedAt: new Date().toISOString(),
  };

  const now = new Date();
  const organizationId = decoded.o;

  try {
    const [existing] = await db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, 'github')
        )
      )
      .limit(1);

    if (existing) {
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
        .where(eq(integrationConnections.id, existing.id));
    } else {
      await db.insert(integrationConnections).values({
        organizationId,
        provider: 'github',
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
    console.error('Failed to persist GitHub integration_connection', err);
    return settingsRedirect(request, {
      integration: 'github',
      error: 'persist_failed',
    });
  }

  return settingsRedirect(request, { integration: 'github', connected: '1' });
}
