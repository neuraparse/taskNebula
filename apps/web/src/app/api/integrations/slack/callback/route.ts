import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, and, eq } from '@tasknebula/db';
import { integrationConnections } from '@tasknebula/db/src/schema/integration-connections';
import { encryptToken } from '@/lib/integrations/token-crypto';

export const dynamic = 'force-dynamic';

const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const STATE_COOKIE_NAME = 'tn_slack_state';
const INTEGRATIONS_PAGE = '/settings/integrations';

/**
 * Redirect helper that always clears the `tn_slack_state` cookie, regardless
 * of whether the flow succeeded or failed.
 */
function redirectAndClearState(origin: string, target: string) {
  const response = NextResponse.redirect(new URL(target, origin));
  response.cookies.set(STATE_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

type SlackOauthAccessResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: { id?: string; name?: string };
  enterprise?: { id?: string; name?: string } | null;
  authed_user?: { id?: string; access_token?: string; scope?: string };
  expires_in?: number;
};

/**
 * GET /api/integrations/slack/callback?code=...&state=...
 *
 * Slack redirects here after the user approves the OAuth app. We verify the
 * CSRF state, exchange the code for tokens, and upsert one row into
 * `integration_connections` keyed on (organization, 'slack').
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const slackError = searchParams.get('error');

  if (slackError) {
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=${encodeURIComponent(slackError)}`
    );
  }

  if (!code || !state) {
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=missing_code_or_state`
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=unauthorized`
    );
  }

  const cookieValue = request.cookies.get(STATE_COOKIE_NAME)?.value;
  if (!cookieValue) {
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=state_expired`
    );
  }

  const firstDot = cookieValue.indexOf('.');
  if (firstDot < 0) {
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=state_malformed`
    );
  }
  const expectedState = cookieValue.slice(0, firstDot);
  const organizationId = cookieValue.slice(firstDot + 1);

  if (expectedState !== state || !organizationId) {
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=state_mismatch`
    );
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=not_configured`
    );
  }

  // Exchange code for tokens.
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  let payload: SlackOauthAccessResponse;
  try {
    const tokenResponse = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });
    payload = (await tokenResponse.json()) as SlackOauthAccessResponse;
  } catch (err) {
    console.error('Slack OAuth exchange failed', err);
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=exchange_failed`
    );
  }

  if (!payload.ok || !payload.access_token) {
    console.error('Slack OAuth rejected', payload.error);
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=${encodeURIComponent(payload.error || 'oauth_failed')}`
    );
  }

  const accessTokenEnc = encryptToken(payload.access_token);
  const refreshTokenEnc = payload.refresh_token
    ? encryptToken(payload.refresh_token)
    : null;

  const workspaceId = payload.team?.id || null;
  const workspaceLabel = payload.team?.name || null;

  // Provider-specific extras we want to keep around for later API calls.
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

  try {
    const [existing] = await db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.organizationId, organizationId),
          eq(integrationConnections.provider, 'slack')
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
          updatedAt: new Date(),
        })
        .where(eq(integrationConnections.id, existing.id));
    } else {
      await db.insert(integrationConnections).values({
        organizationId,
        provider: 'slack',
        externalAccountId: workspaceId,
        externalAccountLabel: workspaceLabel,
        accessTokenEnc,
        refreshTokenEnc,
        scope: payload.scope || null,
        metadata,
        connectedById: session.user.id,
      });
    }
  } catch (err) {
    console.error('Failed to persist Slack integration connection', err);
    return redirectAndClearState(
      origin,
      `${INTEGRATIONS_PAGE}?error=persist_failed`
    );
  }

  return redirectAndClearState(
    origin,
    `${INTEGRATIONS_PAGE}?connected=slack`
  );
}
