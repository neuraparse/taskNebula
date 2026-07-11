import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isLoginOAuthProvider } from '@/lib/auth/login-oauth-providers';
import {
  mintMobileOAuthExchangeToken,
  mobileOAuthRedirect,
  normalizeMobileAuthCallbackUrl,
} from '@/lib/auth/mobile-oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const providerParam = request.nextUrl.searchParams.get('provider');
  const origin = new URL(request.url).origin;
  const callbackUrl = normalizeMobileAuthCallbackUrl(
    request.nextUrl.searchParams.get('callbackUrl'),
    origin
  );
  if (!isLoginOAuthProvider(providerParam)) {
    return mobileOAuthRedirect(request, { status: 'error', reason: 'invalid_provider' });
  }

  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return mobileOAuthRedirect(request, {
      provider: providerParam,
      status: 'error',
      reason: 'unauthorized',
      callbackUrl,
    });
  }

  try {
    const token = await mintMobileOAuthExchangeToken({
      userId,
      email,
      provider: providerParam,
    });
    return mobileOAuthRedirect(request, {
      provider: providerParam,
      status: 'authenticated',
      token,
      callbackUrl,
    });
  } catch (error) {
    console.error('[mobile-auth-oauth] exchange token mint failed', error);
    return mobileOAuthRedirect(request, {
      provider: providerParam,
      status: 'error',
      reason: 'server_error',
      callbackUrl,
    });
  }
}
