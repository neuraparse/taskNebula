import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, organizationMembers, eq, and } from '@tasknebula/db';
import {
  JIRA_STATE_COOKIE,
  buildJiraAuthorizeUrl,
  getJiraClientCredentials,
} from '@/lib/integrations/jira';

/**
 * GET /api/integrations/jira/authorize
 *
 * Kicks off the Atlassian 3LO flow. Generates a signed `state` that carries
 * the active organization id and a random nonce, stores the nonce in a short-
 * lived httpOnly cookie (`tn_jira_state`), then 302s to Atlassian.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    getJiraClientCredentials();
  } catch {
    return NextResponse.json(
      { error: 'Jira integration is not configured on this server.' },
      { status: 501 }
    );
  }

  const requestedOrgId = request.nextUrl.searchParams.get('organizationId');
  if (!requestedOrgId) {
    return NextResponse.json(
      { error: 'organizationId query parameter is required' },
      { status: 400 }
    );
  }

  // Confirm the caller is a member of the requested organization before we
  // embed it in the OAuth state.
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, requestedOrgId)
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const statePayload = {
    nonce,
    organizationId: requestedOrgId,
    userId: session.user.id,
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64url');

  const authorizeUrl = buildJiraAuthorizeUrl({ state });

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(JIRA_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });
  return response;
}
