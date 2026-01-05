import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, searchHistory } from '@tasknebula/db';
import { eq, and, desc, lt } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search-history?organizationId=xxx&projectId=xxx&limit=10
 * 
 * Get recent search history for current user
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
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Build conditions
    const conditions: any[] = [
      eq(searchHistory.userId, session.user.id),
      eq(searchHistory.organizationId, organizationId),
    ];

    if (projectId) {
      conditions.push(eq(searchHistory.projectId, projectId));
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
 * DELETE /api/search-history?organizationId=xxx
 * 
 * Clear search history for current user
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
          eq(searchHistory.organizationId, organizationId)
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
 * POST /api/search-history/cleanup
 * 
 * Clean up old search history (older than 30 days)
 * This should be called periodically by a cron job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete entries older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await db
      .delete(searchHistory)
      .where(lt(searchHistory.createdAt, thirtyDaysAgo));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cleanup search history error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup search history' },
      { status: 500 }
    );
  }
}

