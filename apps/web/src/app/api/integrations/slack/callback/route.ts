/**
 * GET /api/integrations/slack/callback?code=...&state=...
 *
 * Slack redirects here after the user approves the OAuth app. We:
 *   1. validate the CSRF state cookie matches the state query param,
 *   2. exchange the code for a bot token via oauth.v2.access,
 *   3. upsert one row in `integration_connections` keyed on (org, 'slack'),
 *      storing the bot token in `accessTokenEnc` (AES-256-GCM envelope) and
 *      stashing workspace/app/bot ids in `metadata` for later API calls.
 *
 * Mirrors the GitHub callback shape — same state format (base64url JSON with
 * `{n, o, u}`), same redirect targets (`/settings/integrations?...`).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, and, eq } from '@tasknebula/db';
import { integrationConnections } from '@tasknebula/db/src/schema/integration-connections';
import { encryptToken } from '@/lib/integrations/token-crypto';
import { hasPermission } from '@/lib/auth/permissions';
import { SLACK_PROVIDER, SLACK_STATE_COOKIE, exchangeSlackCode } from '@/lib/integrations/slack';

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
  response.cookies.delete(SLACK_STATE_COOKIE);
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
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: errorParam,
    });
  }
  if (!code || !state) {
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: 'missing_code_or_state',
    });
  }

  const cookieState = request.cookies.get(SLACK_STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: 'invalid_state',
    });
  }

  const decoded = decodeState(state);
  if (!decoded || decoded.u !== session.user.id) {
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: 'invalid_state',
    });
  }

  if (!(await hasPermission(decoded.o, 'org:settings'))) {
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: 'forbidden',
    });
  }

  let payload;
  try {
    payload = await exchangeSlackCode(code);
  } catch (err) {
    console.error('Slack token exchange threw', err);
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: 'token_exchange_failed',
    });
  }

  if (!payload.ok || !payload.access_token) {
    console.error('Slack OAuth rejected', payload.error);
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: payload.error || 'no_access_token',
    });
  }

  const accessTokenEnc = encryptToken(payload.access_token);
  const refreshTokenEnc = payload.refresh_token ? encryptToken(payload.refresh_token) : null;

  const workspaceId = payload.team?.id || null;
  const workspaceLabel = payload.team?.name || null;

  // Provider-specific extras we need to keep around. `botUserId` lets us
  // filter our own bot's messages out of Events API handlers to avoid loops,
  // and `authedUserId` is the installing user's Slack id (useful for /tn
  // commands to scope "my issues").
  const metadata = {
    appId: payload.app_id || null,
    botUserId: payload.bot_user_id || null,
    tokenType: payload.token_type || null,
    enterpriseId: payload.enterprise?.id || null,
    enterpriseName: payload.enterprise?.name || null,
    authedUserId: payload.authed_user?.id || null,
    expiresIn: payload.expires_in ?? null,
    connectedAt: new Date().toISOString(),
  };

  const organizationId = decoded.o;
  const now = new Date();

  try {
    const [existing] = await db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, SLACK_PROVIDER)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(integrationConnections)
        .set({
          externalAccountId: workspaceId,
          externalAccountLabel: workspaceLabel,
          accessTokenEnc,
          refreshTokenEnc,
          scope: payload.scope || null,
          metadata,
          connectedById: session.user.id,
          updatedAt: now,
        })
        .where(eq(integrationConnections.id, existing.id));
    } else {
      await db.insert(integrationConnections).values({
        organizationId,
        provider: SLACK_PROVIDER,
        externalAccountId: workspaceId,
        externalAccountLabel: workspaceLabel,
        accessTokenEnc,
        refreshTokenEnc,
        scope: payload.scope || null,
        metadata,
        connectedById: session.user.id,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('Failed to persist Slack integration_connection', err);
    return settingsRedirect(request, {
      integration: SLACK_PROVIDER,
      error: 'persist_failed',
    });
  }

  return settingsRedirect(request, {
    integration: SLACK_PROVIDER,
    connected: '1',
  });
}
