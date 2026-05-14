/**
 * GET /api/integrations/slack/install?organizationId=<id>
 *
 * Starts the Slack OAuth v2 install flow:
 *   1. Confirms the caller is signed in and belongs to the target org.
 *   2. Mints a base64url-encoded `{n, o, u}` state blob (nonce + org + user).
 *   3. Stores the same blob in an HttpOnly cookie so the callback can verify
 *      both the CSRF nonce and which org to bind the connection to.
 *   4. Redirects to https://slack.com/oauth/v2/authorize with the bot scopes
 *      documented in `SLACK_DEFAULT_SCOPES`.
 *
 * The legacy `/api/integrations/slack/authorize` route delegates here so any
 * UI button still pointing at it keeps working.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { db, organizationMembers, and, eq } from '@tasknebula/db';
import {
  SLACK_STATE_COOKIE,
  buildSlackAuthorizeUrl,
  getSlackClientCredentials,
} from '@/lib/integrations/slack';

export const dynamic = 'force-dynamic';

const STATE_TTL_SECONDS = 10 * 60;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json(
      { error: 'organizationId is required' },
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

  // Resolve credentials early so we can surface a 500 with a useful message
  // instead of bouncing the user to Slack and getting an opaque error there.
  try {
    await getSlackClientCredentials();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Slack OAuth is not configured.',
      },
      { status: 500 }
    );
  }

  const nonce = crypto.randomBytes(24).toString('base64url');
  const statePayload = { n: nonce, o: organizationId, u: session.user.id };
  const state = Buffer.from(JSON.stringify(statePayload), 'utf8').toString(
    'base64url'
  );

  const authorizeUrl = await buildSlackAuthorizeUrl({ state });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(SLACK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
