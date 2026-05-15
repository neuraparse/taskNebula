/**
 * SP-initiated SAML AuthnRequest entrypoint.
 *
 * `POST` (preferred — keeps the browser nav method consistent with the IdP
 *        round-trip), `GET` (for convenience / direct browser links) both
 *        build a redirect-binding URL via samlify and 302 the user to the
 *        IdP. The state cookie carries the workspace slug so the callback
 *        can re-resolve the config without trusting the URL.
 */
import { NextRequest, NextResponse } from 'next/server';
import { loadSsoForSlug } from '@/lib/sso/workspace';
import { buildAuthnRequestUrl, getBaseUrl, type SamlContext } from '@/lib/sso/saml';
import { mintRelayState } from '@/lib/sso/relay-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ workspace_slug: string }> }
) {
  const { workspace_slug: slug } = await params;
  const workspace = await loadSsoForSlug(slug);

  if (!workspace || !workspace.config.enabled) {
    return NextResponse.json(
      { error: 'SSO is not configured for this workspace' },
      { status: 404 }
    );
  }
  if (workspace.config.provider !== 'saml') {
    return NextResponse.json({ error: 'Only SAML is supported by this endpoint' }, { status: 400 });
  }

  const ctx: SamlContext = {
    config: workspace.config,
    workspaceSlug: workspace.workspaceSlug,
    baseUrl: getBaseUrl(),
  };

  let redirectUrl: string;
  try {
    redirectUrl = buildAuthnRequestUrl(ctx);
  } catch (err) {
    console.error('SAML init failed:', err);
    return NextResponse.json({ error: 'Failed to build SAML AuthnRequest' }, { status: 500 });
  }

  // Append a signed RelayState. The IdP echoes this verbatim on the
  // callback; the verify step on `/callback` gives us a CSRF guard plus
  // a 5-minute replay window without depending on the workspace-slug
  // cookie alone (which a hostile site could try to plant via SameSite=lax
  // navigation).
  const relayState = mintRelayState(workspace.workspaceSlug);
  const finalUrl = redirectUrl.includes('?')
    ? `${redirectUrl}&RelayState=${encodeURIComponent(relayState)}`
    : `${redirectUrl}?RelayState=${encodeURIComponent(relayState)}`;

  // Stash the slug so the callback can authenticate the request without
  // trusting query params that may have been mangled by the IdP.
  const response = NextResponse.redirect(finalUrl, 302);
  response.cookies.set('tn_saml_workspace', workspace.workspaceSlug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  return response;
}

export const GET = handle;
export const POST = handle;
