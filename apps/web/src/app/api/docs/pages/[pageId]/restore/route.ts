import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import {
  and,
  createAuditLog,
  db,
  documentPageRevisions,
  documentPages,
  eq,
} from '@tasknebula/db';
import {
  buildDocumentPageResponse,
  ensureUniqueDocumentSlug,
  resolveDocumentPageAccess,
  replaceDocumentLinks,
} from '@/lib/docs/server';
import { extractInternalDocumentLinkIds } from '@/lib/docs/content';

const restoreRevisionSchema = z.object({
  revision: z.number().int().positive().optional(),
  revisionId: z.string().optional(),
});

export async function POST(
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
    if (!access?.permissions.canEdit) {
      return NextResponse.json({ error: 'You do not have permission to restore this page' }, { status: 403 });
    }

    const body = await request.json();
    const data = restoreRevisionSchema.parse(body);

    const [revision] = await db
      .select()
      .from(documentPageRevisions)
      .where(
        data.revisionId
          ? and(eq(documentPageRevisions.pageId, pageId), eq(documentPageRevisions.id, data.revisionId))
          : and(eq(documentPageRevisions.pageId, pageId), eq(documentPageRevisions.revision, data.revision || 0))
      )
      .limit(1);

    if (!revision) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    }

    const nextRevision = access.page.currentRevision + 1;
    const restoredSlug = await ensureUniqueDocumentSlug(
      access.page.spaceId,
      access.page.parentId || null,
      revision.title,
      access.page.id
    );
    const [updatedPage] = await db
      .update(documentPages)
      .set({
        title: revision.title,
        slug: restoredSlug,
        contentJson: revision.contentJson,
        contentText: revision.contentText,
        excerpt: revision.excerpt,
        currentRevision: nextRevision,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(documentPages.id, pageId))
      .returning();

    if (!updatedPage) {
      return NextResponse.json({ error: 'Failed to restore document page' }, { status: 500 });
    }

    await db.insert(documentPageRevisions).values({
      pageId,
      revision: nextRevision,
      title: revision.title,
      contentJson: revision.contentJson,
      contentText: revision.contentText,
      excerpt: revision.excerpt,
      changeSummary: `Restored from revision ${revision.revision}`,
      createdBy: session.user.id,
    });

    await replaceDocumentLinks(pageId, extractInternalDocumentLinkIds(revision.contentJson), session.user.id);

    await createAuditLog({
      userId: session.user.id,
      organizationId: access.organizationId,
      action: 'document.restored',
      resourceType: 'document',
      resourceId: pageId,
      projectId: access.projectId || undefined,
      metadata: { restoredFromRevision: revision.revision, newRevision: nextRevision },
    });

    const responsePage = await buildDocumentPageResponse(session.user.id, updatedPage.id);
    if (!responsePage) {
      return NextResponse.json({ error: 'Failed to load restored document page' }, { status: 500 });
    }

    return NextResponse.json(responsePage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Error restoring document revision:', error);
    return NextResponse.json({ error: 'Failed to restore document revision' }, { status: 500 });
  }
}
