import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { reconcileUserVerification } from '@/lib/auth/email-verification';

/**
 * POST /api/auth/verify-email/refresh
 *
 * Authenticated self-service endpoint for the "Already verified?" escape
 * hatch in the verification banner. Re-reads the caller's DB state and —
 * when a completed verification flow is detected — marks the user
 * verified. Returns `{ verified: boolean }`.
 *
 * This exists so a re-clicked or lost verification email doesn't strand
 * the user with a banner they can't dismiss. It never verifies an
 * account unless there's already evidence in the verification token
 * history that the user went through the flow.
 */
export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await reconcileUserVerification(session.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[verify-email/refresh] unexpected error:', error);
    return NextResponse.json({ verified: false }, { status: 200 });
  }
}
