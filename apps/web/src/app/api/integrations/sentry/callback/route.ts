/**
 * GET /api/integrations/sentry/callback?code=...&state=...
 *
 * Verifies the state cookie, exchanges the code for tokens, and upserts
 * `integration_connections` (provider = 'sentry'). The Sentry token endpoint
 * returns the connected organization slug — we surface it as the
 * externalAccount label so the settings UI can show e.g. "Connected to
 * acme-prod".
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, integrationConnections } from '@tasknebula/db';
import { auth } from '@/auth';
import { encryptToken } from '@/lib/integrations/token-crypto';
import {
  SENTRY_STATE_COOKIE,
  exchangeSentryCode,
} from '@/lib/integrations/sentry';

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

function settingsRedirect(
  request: NextRequest,
  params: Record<string, string>
): NextResponse {
  const url = new URL('/settings', request.url);
  url.searchParams.set('tab', 'integrations');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = NextResponse.redirect(url.toString());
  response.cookies.delete(SENTRY_STATE_COOKIE);
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
    return settingsRedirect(request, { integration: 'sentry', error: errorParam });
  }
  if (!code || !state) {
    return settingsRedirect(request, {
      integration: 'sentry',
      error: 'missing_code_or_state',
    });
  }

  const cookieState = request.cookies.get(SENTRY_STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return settingsRedirect(request, {
      integration: 'sentry',
      error: 'invalid_state',
    });
  }

  const decoded = decodeState(state);
  if (!decoded || decoded.u !== session.user.id) {
    return settingsRedirect(request, {
      integration: 'sentry',
      error: 'invalid_state',
    });
  }

  let tokenJson;
  try {
    tokenJson = await exchangeSentryCode(code);
  } catch (err) {
    console.error('Sentry token exchange threw', err);
    return settingsRedirect(request, {
      integration: 'sentry',
      error: 'token_exchange_failed',
    });
  }

  if (tokenJson.error || !tokenJson.access_token) {
    console.error('Sentry OAuth rejected', tokenJson.error, tokenJson.error_description);
    return settingsRedirect(request, {
      integration: 'sentry',
      error: tokenJson.error || 'no_access_token',
    });
  }

  const accessTokenEnc = encryptToken(tokenJson.access_token);
  const refreshTokenEnc = tokenJson.refresh_token
    ? encryptToken(tokenJson.refresh_token)
    : null;

  const externalAccountId = tokenJson.organization?.id || tokenJson.organization?.slug || '';
  const externalAccountLabel =
    tokenJson.organization?.name || tokenJson.organization?.slug || '';

  const metadata = {
    tokenType: tokenJson.token_type ?? null,
    expiresAt: tokenJson.expires_at ?? null,
    organizationSlug: tokenJson.organization?.slug ?? null,
    organizationName: tokenJson.organization?.name ?? null,
    userId: tokenJson.user?.id ?? null,
    userEmail: tokenJson.user?.email ?? null,
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
          eq(integrationConnections.provider, 'sentry')
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
        provider: 'sentry',
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
    console.error('Failed to persist Sentry integration_connection', err);
    return settingsRedirect(request, {
      integration: 'sentry',
      error: 'persist_failed',
    });
  }

  return settingsRedirect(request, { integration: 'sentry', connected: '1' });
}
