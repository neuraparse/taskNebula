/**
 * GET /api/integrations/sentry/authorize?organizationId=...
 *
 * Initiates the Sentry OAuth flow. The state cookie carries the
 * organizationId + userId so the callback can verify both the CSRF nonce
 * and the target org without re-deriving it from the session alone.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { db, organizationMembers, and, eq } from '@tasknebula/db';
import { getClientCredentials } from '@/lib/integrations/client-credentials';
import {
  SENTRY_DEFAULT_SCOPE,
  SENTRY_STATE_COOKIE,
  sentryAuthorizeUrl,
} from '@/lib/integrations/sentry';

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

  const credentials = await getClientCredentials('sentry');
  if (!credentials) {
    return NextResponse.json(
      {
        error:
          'Sentry OAuth is not configured. Add a client id and secret in Admin → Integrations, or set SENTRY_CLIENT_ID / SENTRY_CLIENT_SECRET.',
      },
      { status: 500 }
    );
  }

  const redirectUri =
    credentials.redirectUri ||
    `${new URL(request.url).origin}/api/integrations/sentry/callback`;
  const scope = credentials.scope || SENTRY_DEFAULT_SCOPE;

  const nonce = crypto.randomBytes(24).toString('base64url');
  const statePayload = { n: nonce, o: organizationId, u: session.user.id };
  const state = Buffer.from(JSON.stringify(statePayload), 'utf8').toString(
    'base64url'
  );

  const authorizeUrl = new URL(sentryAuthorizeUrl());
  authorizeUrl.searchParams.set('client_id', credentials.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(SENTRY_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
