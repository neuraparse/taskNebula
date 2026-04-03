import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildDocumentTree } from '@/lib/docs/tree';
import { resolveDocumentPageAccess } from '@/lib/docs/server';
import { db } from '@tasknebula/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { pageId } = await params;
    const access = await resolveDocumentPageAccess(session.user.id, pageId);
    if (!access?.permissions.canBrowse) {
      return NextResponse.json({ error: 'Page not found or unavailable' }, { status: 404 });
    }

    const pages = await db.query.documentPages.findMany({
      where: (table, { and, eq }) => and(eq(table.spaceId, access.space.id), eq(table.isArchived, false)),
      orderBy: (table, { asc }) => [asc(table.position), asc(table.title)],
    });

    return NextResponse.json({
      tree: buildDocumentTree(pages),
      currentPageId: access.page.id,
      space: access.space,
    });
  } catch (error) {
    console.error('Error fetching document tree:', error);
    return NextResponse.json({ error: 'Failed to fetch document tree' }, { status: 500 });
  }
}
