import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { markSavedFilterUsedForUser } from '@/lib/saved-filters/usage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/saved-filters/[filterId]/use
 *
 * Increment usage count and update last used timestamp.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ filterId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filterId } = await params;
    const updated = await markSavedFilterUsedForUser(filterId, session.user.id);

    if (!updated) {
      return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
    }

    return NextResponse.json({ filter: updated });
  } catch (error) {
    console.error('Update filter usage error:', error);
    return NextResponse.json({ error: 'Failed to update filter usage' }, { status: 500 });
  }
}
