import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, searchHistory } from '@tasknebula/db';
import { eq, and, desc, lt, type SQL } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search-history?organizationId=xxx&projectId=xxx&limit=10&pinned=true
 *
 * Get recent (or pinned) search history for current user. The Cmd+K
 * omnibar (FEAT-25) calls this twice on open: once for `pinned=true`
 * and once for plain recents.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const projectId = searchParams.get('projectId');
    const pinnedOnlyParam = searchParams.get('pinned');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Build conditions
    const conditions: SQL[] = [
      eq(searchHistory.userId, session.user.id),
      eq(searchHistory.organizationId, organizationId),
    ];

    if (projectId) {
      conditions.push(eq(searchHistory.projectId, projectId));
    }

    if (pinnedOnlyParam === 'true') {
      conditions.push(eq(searchHistory.pinned, true));
    }

    const history = await db
      .select()
      .from(searchHistory)
      .where(and(...conditions))
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Get search history error:', error);
    return NextResponse.json(
      { error: 'Failed to get search history' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/search-history
 *
 * Body: { id: string, pinned: boolean }
 *
 * Pin or unpin a saved query (FEAT-25). We restrict updates to rows
 * owned by the current user — no organization-wide pinning.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as
      | { id?: string; pinned?: boolean }
      | null;

    if (!body || typeof body.id !== 'string' || typeof body.pinned !== 'boolean') {
      return NextResponse.json(
        { error: 'Body must include { id: string, pinned: boolean }' },
        { status: 400 }
      );
    }

    const updated = await db
      .update(searchHistory)
      .set({ pinned: body.pinned })
      .where(
        and(
          eq(searchHistory.id, body.id),
          eq(searchHistory.userId, session.user.id)
        )
      )
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ item: updated[0] });
  } catch (error) {
    console.error('Update search history error:', error);
    return NextResponse.json(
      { error: 'Failed to update search history' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/search-history?organizationId=xxx
 *
 * Clear unpinned search history for current user. Pinned entries are
 * preserved — call PATCH with `{ pinned: false }` first to drop them.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    await db
      .delete(searchHistory)
      .where(
        and(
          eq(searchHistory.userId, session.user.id),
          eq(searchHistory.organizationId, organizationId),
          eq(searchHistory.pinned, false)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear search history error:', error);
    return NextResponse.json(
      { error: 'Failed to clear search history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/search-history
 *
 * Clean up unpinned search history older than 30 days. Called by the
 * scheduled cleanup job. Pinned rows are kept until the user explicitly
 * removes them.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await db
      .delete(searchHistory)
      .where(
        and(
          lt(searchHistory.createdAt, thirtyDaysAgo),
          eq(searchHistory.pinned, false)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cleanup search history error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup search history' },
      { status: 500 }
    );
  }
}
