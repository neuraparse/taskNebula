/**
 * GET /api/integrations/github/authorize?organizationId=...
 *
 * Kicks off the GitHub OAuth flow:
 *   1. Confirms the caller is signed in and a member of the org.
 *   2. Mints a random nonce + base64url-encodes `{n, o, u}` as the OAuth state.
 *   3. Stores the same encoded blob in an HttpOnly cookie so the callback can
 *      validate both the CSRF nonce and the target organization.
 *   4. Redirects to GitHub's authorize endpoint with the resolved client id,
 *      redirect URI, and scope.
 *
 * Mirrors the GitLab authorize route — both write to the shared
 * `integration_connections` table on callback, keyed on (org, provider).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { db, organizationMembers, and, eq } from '@tasknebula/db';
import { getClientCredentials } from '@/lib/integrations/client-credentials';
import {
  GITHUB_DEFAULT_SCOPE,
  GITHUB_AUTHORIZE_URL,
  GITHUB_STATE_COOKIE,
} from '@/lib/integrations/github';

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

  const credentials = await getClientCredentials('github');
  if (!credentials) {
    return NextResponse.json(
      {
        error:
          'GitHub OAuth is not configured. Add a client id and secret in Admin → Integrations, or set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET.',
      },
      { status: 500 }
    );
  }

  // Resolve a redirect URI: prefer the value the admin saved, fall back to
  // the canonical `/api/integrations/github/callback` rooted on this host.
  const redirectUri =
    credentials.redirectUri ||
    `${new URL(request.url).origin}/api/integrations/github/callback`;
  const scope = credentials.scope || GITHUB_DEFAULT_SCOPE;

  const nonce = crypto.randomBytes(24).toString('base64url');
  const statePayload = { n: nonce, o: organizationId, u: session.user.id };
  const state = Buffer.from(JSON.stringify(statePayload), 'utf8').toString(
    'base64url'
  );

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', credentials.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('allow_signup', 'true');

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
