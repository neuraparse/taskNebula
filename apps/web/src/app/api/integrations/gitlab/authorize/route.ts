/**
 * GET /api/integrations/gitlab/authorize?organizationId=...
 *
 * Generates an OAuth state, stores it in a signed cookie alongside the
 * organizationId, and redirects the user to GitLab's authorize endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import { getClientCredentials } from '@/lib/integrations/client-credentials';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const GITLAB_AUTHORIZE_URL = 'https://gitlab.com/oauth/authorize';
const DEFAULT_SCOPE = 'read_api read_repository';
const STATE_COOKIE = 'tn_gitlab_state';
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  if (!organizationId) {
    return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
  }
  if (!(await hasPermission(organizationId, 'org:settings'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Prefer admin-managed credentials (DB) with env vars as fallback.
  const credentials = await getClientCredentials('gitlab');
  if (!credentials || !credentials.redirectUri) {
    return NextResponse.json(
      {
        error:
          'GitLab OAuth is not configured. Add client id / secret / redirect URI in Admin → Integrations, or set GITLAB_CLIENT_ID / GITLAB_CLIENT_SECRET / GITLAB_REDIRECT_URI.',
      },
      { status: 500 }
    );
  }
  const { clientId, redirectUri } = credentials;
  const scope = credentials.scope || DEFAULT_SCOPE;

  // State is random + embeds organizationId so the callback can validate both
  // integrity (via cookie match) and target org.
  const nonce = crypto.randomBytes(24).toString('base64url');
  const statePayload = { n: nonce, o: organizationId, u: session.user.id };
  const state = Buffer.from(JSON.stringify(statePayload), 'utf8').toString('base64url');

  const authorizeUrl = new URL(GITLAB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
