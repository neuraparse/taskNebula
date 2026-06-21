import { NextResponse } from 'next/server';
import { getLoginOAuthAvailability } from '@/lib/auth/login-oauth-providers';

export const dynamic = 'force-dynamic';

export async function GET() {
  let providers = { github: false, google: false };

  try {
    providers = await getLoginOAuthAvailability();
  } catch (error) {
    console.error('[auth/oauth-providers] failed to resolve login providers', error);
  }

  return NextResponse.json(
    { providers },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
