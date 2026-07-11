import { NextRequest, NextResponse } from 'next/server';
import { getLoginOAuthCredentials, isLoginOAuthProvider } from '@/lib/auth/login-oauth-providers';
import { normalizeMobileAuthCallbackUrl } from '@/lib/auth/mobile-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const providerParam = request.nextUrl.searchParams.get('provider');
  if (!isLoginOAuthProvider(providerParam)) {
    return NextResponse.json({ error: 'invalid_provider' }, { status: 400 });
  }

  const credentials = await getLoginOAuthCredentials();
  if (!credentials[providerParam]) {
    return NextResponse.json({ error: 'oauth_not_configured' }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const completeUrl = new URL('/api/auth/mobile/oauth/complete', origin);
  completeUrl.searchParams.set('provider', providerParam);
  const callbackUrl = normalizeMobileAuthCallbackUrl(
    request.nextUrl.searchParams.get('callbackUrl'),
    origin
  );
  if (callbackUrl) completeUrl.searchParams.set('callbackUrl', callbackUrl);

  const signInUrl = new URL(`/api/auth/signin/${providerParam}`, origin);
  signInUrl.searchParams.set('callbackUrl', completeUrl.toString());
  return NextResponse.redirect(signInUrl.toString());
}
