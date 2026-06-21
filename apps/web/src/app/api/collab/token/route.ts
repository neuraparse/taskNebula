import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { auth } from '@/auth';
import { userHasWorkspaceAccess } from '@/lib/auth/workspace-access';

/**
 * Mint a short-lived JWT for the Hocuspocus server.
 *
 * The token is signed with the same `AUTH_SECRET` the rest of the app uses
 * for NextAuth, so the standalone Hocuspocus service can verify it without
 * any additional shared state. Lifetime is intentionally short (5 minutes)
 * — the Hocuspocus provider will simply re-fetch when the socket reconnects.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await userHasWorkspaceAccess(session.user.id))) {
    return NextResponse.json({ error: 'Workspace access required' }, { status: 403 });
  }

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Collaboration token signing is not configured' },
      { status: 503 }
    );
  }

  const key = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    sub: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    scope: 'collab',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 5)
    .setIssuer('tasknebula-web')
    .setAudience('tasknebula-collab')
    .sign(key);

  return NextResponse.json({
    token,
    user: {
      id: session.user.id,
      name: session.user.name ?? session.user.email ?? 'Anonymous',
    },
  });
}
