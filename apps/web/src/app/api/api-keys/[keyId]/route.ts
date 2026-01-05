import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, apiKeys } from '@tasknebula/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// DELETE /api/api-keys/[keyId] - Revoke API key
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keyId } = await params;

    // Revoke the API key
    const [revokedKey] = await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy: session.user.id,
      })
      .where(eq(apiKeys.id, keyId))
      .returning();

    if (!revokedKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}

