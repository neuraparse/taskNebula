import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, documentPageRevisions, eq, users } from '@tasknebula/db';
import { resolveDocumentPageAccess } from '@/lib/docs/server';

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

    const revisions = await db
      .select({
        id: documentPageRevisions.id,
        pageId: documentPageRevisions.pageId,
        revision: documentPageRevisions.revision,
        title: documentPageRevisions.title,
        contentText: documentPageRevisions.contentText,
        excerpt: documentPageRevisions.excerpt,
        changeSummary: documentPageRevisions.changeSummary,
        createdAt: documentPageRevisions.createdAt,
        createdBy: documentPageRevisions.createdBy,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(documentPageRevisions)
      .leftJoin(users, eq(documentPageRevisions.createdBy, users.id))
      .where(eq(documentPageRevisions.pageId, pageId))
      .orderBy(documentPageRevisions.revision);

    return NextResponse.json({ revisions: revisions.reverse() });
  } catch (error) {
    console.error('Error fetching document revisions:', error);
    return NextResponse.json({ error: 'Failed to fetch document revisions' }, { status: 500 });
  }
}
