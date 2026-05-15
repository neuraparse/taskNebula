/**
 * SAML Assertion Consumer Service (ACS).
 *
 * The IdP POSTs an XML SAML response (base64) here. We:
 *   1. Resolve the workspace from the URL slug + cookie.
 *   2. Verify the response signature + envelope using samlify.
 *   3. Resolve attributes into our internal user shape.
 *   4. JIT-provision the user + workspace membership.
 *   5. Hand off to Auth.js by setting a Credentials session.
 *
 * Auth.js v5's `signIn('credentials', { ... })` server-action expects a
 * NextRequest-compatible POST handler to be active. Since we're already
 * inside a route handler, we redirect to the standard `/auth/signin`
 * Credentials callback with a one-time short-lived token that the
 * Credentials provider can exchange for the user. The plumbing for that
 * exchange is handled by the helper in `apps/web/src/lib/sso/session.ts`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadSsoForSlug } from '@/lib/sso/workspace';
import { parseLoginResponse, getBaseUrl, type SamlContext } from '@/lib/sso/saml';
import { resolveUserAttributes } from '@/lib/sso/attribute-map';
import { jitProvisionUser } from '@/lib/sso/jit';
import { mintSamlExchangeToken } from '@/lib/sso/session';
import { verifyRelayState } from '@/lib/sso/relay-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspace_slug: string }> }
) {
  const { workspace_slug: slug } = await params;

  // Cookie wins over URL — protects against open-redirect via /api/auth/saml/<unrelated>/callback
  const slugFromCookie = request.cookies.get('tn_saml_workspace')?.value;
  const resolvedSlug = slugFromCookie || slug;

  const workspace = await loadSsoForSlug(resolvedSlug);
  if (!workspace || !workspace.config.enabled) {
    return NextResponse.json({ error: 'SSO not configured for this workspace' }, { status: 404 });
  }

  const formData = await request.formData();
  const samlResponse = formData.get('SAMLResponse');
  if (typeof samlResponse !== 'string' || !samlResponse) {
    return NextResponse.json({ error: 'Missing SAMLResponse' }, { status: 400 });
  }

  // RelayState defence — verify the value the IdP echoed back was minted
  // by us, has not expired, and addresses the same workspace slug as the
  // cookie + URL. A missing RelayState is treated as an error so that
  // upgrading from a no-RelayState build to this one forces the IdP-side
  // metadata refresh to start carrying it.
  const relayValue = formData.get('RelayState');
  if (typeof relayValue !== 'string' || !relayValue) {
    return NextResponse.json({ error: 'Missing RelayState' }, { status: 400 });
  }
  const relayResult = verifyRelayState(relayValue);
  if (!relayResult.ok) {
    console.warn('SAML RelayState rejected:', relayResult.reason);
    return NextResponse.json(
      { error: `Invalid RelayState (${relayResult.reason})` },
      { status: 400 }
    );
  }
  if (relayResult.slug !== resolvedSlug) {
    console.warn(
      `SAML RelayState slug mismatch: relay=${relayResult.slug}, resolved=${resolvedSlug}`
    );
    return NextResponse.json({ error: 'RelayState workspace mismatch' }, { status: 400 });
  }

  const ctx: SamlContext = {
    config: workspace.config,
    workspaceSlug: workspace.workspaceSlug,
    baseUrl: getBaseUrl(),
  };

  let assertion;
  try {
    assertion = await parseLoginResponse(ctx, samlResponse);
  } catch (err) {
    console.error('SAML response verification failed:', err);
    return NextResponse.json({ error: 'Invalid SAML response' }, { status: 401 });
  }

  let internalUser;
  try {
    internalUser = resolveUserAttributes(
      assertion,
      workspace.config.attributeMap as Record<string, unknown>
    );
  } catch (err) {
    console.error('SAML attribute resolution failed:', err);
    return NextResponse.json(
      { error: 'SAML response is missing required attributes' },
      { status: 400 }
    );
  }

  const jit = await jitProvisionUser({
    email: internalUser.email,
    firstName: internalUser.firstName,
    lastName: internalUser.lastName,
    workspaceId: workspace.workspaceId,
    groups: internalUser.groups,
  });

  // Mint a short-lived exchange token. The matching Credentials provider in
  // auth.ts redeems it and returns a User object, which Auth.js then turns
  // into a JWT session.
  const exchangeToken = await mintSamlExchangeToken({
    userId: jit.userId,
    email: internalUser.email,
    workspaceId: workspace.workspaceId,
  });

  const redirectTo = new URL('/api/auth/saml/exchange', getBaseUrl());
  redirectTo.searchParams.set('token', exchangeToken);
  redirectTo.searchParams.set('workspace', workspace.workspaceSlug);

  const res = NextResponse.redirect(redirectTo.toString(), 303);
  res.cookies.delete('tn_saml_workspace');
  return res;
}
