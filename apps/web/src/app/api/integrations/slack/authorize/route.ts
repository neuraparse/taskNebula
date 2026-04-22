import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { db, organizationMembers, and, eq } from '@tasknebula/db';

export const dynamic = 'force-dynamic';

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_DEFAULT_BOT_SCOPES = 'channels:read,chat:write';
const STATE_COOKIE_NAME = 'tn_slack_state';
const STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/**
 * GET /api/integrations/slack/authorize?organizationId=<id>
 *
 * Kicks off the Slack OAuth flow:
 *   1. Confirms the caller is signed in and belongs to the org.
 *   2. Mints a random 32-byte hex CSRF `state` token.
 *   3. Stores `<state>.<organizationId>` in an HttpOnly cookie so the
 *      callback can validate both the CSRF nonce and the org to connect.
 *   4. Redirects the browser to Slack's authorization endpoint.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          'Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_REDIRECT_URI.',
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId query parameter is required' },
      { status: 400 }
    );
  }

  // Membership check — only org members can bind an integration.
  const [member] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!member) {
    return NextResponse.json(
      { error: 'You do not have access to this organization.' },
      { status: 403 }
    );
  }

  const state = crypto.randomBytes(32).toString('hex');
  const cookieValue = `${state}.${organizationId}`;

  const authorizeUrl = new URL(SLACK_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('scope', SLACK_DEFAULT_BOT_SCOPES);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(STATE_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
