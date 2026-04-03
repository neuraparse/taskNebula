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
  ensureUniqueDocumentSlug,
  buildDocumentPageResponse,
  resolveDocumentPageAccess,
  replaceDocumentLinks,
} from '@/lib/docs/server';
import {
  extractDocumentExcerpt,
  extractDocumentText,
  extractInternalDocumentLinkIds,
} from '@/lib/docs/content';

const updatePageSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  icon: z.string().max(50).nullable().optional(),
  contentJson: z.record(z.any()).optional(),
  changeSummary: z.string().max(500).optional(),
  expectedRevision: z.number().int().positive(),
});

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

    const responsePage = await buildDocumentPageResponse(session.user.id, pageId);
    if (!responsePage) {
      return NextResponse.json({ error: 'Page not found or unavailable' }, { status: 404 });
    }

    return NextResponse.json(responsePage);
  } catch (error) {
    console.error('Error fetching document page:', error);
    return NextResponse.json({ error: 'Failed to fetch document page' }, { status: 500 });
  }
}

export async function PATCH(
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
      return NextResponse.json({ error: 'You do not have permission to edit this page' }, { status: 403 });
    }

    const body = await request.json();
    const data = updatePageSchema.parse(body);
    const currentPage = access.page;

    if (currentPage.currentRevision !== data.expectedRevision) {
      return NextResponse.json(
        { error: 'This page has changed since you opened it', currentRevision: currentPage.currentRevision },
        { status: 409 }
      );
    }

    const nextTitle = data.title || currentPage.title;
    const nextContentJson = data.contentJson || (currentPage.contentJson as Record<string, unknown>);
    const nextContentText = extractDocumentText(nextContentJson);
    const nextExcerpt = extractDocumentExcerpt(nextContentJson);
    const nextSlug = data.title
      ? await ensureUniqueDocumentSlug(currentPage.spaceId, currentPage.parentId || null, data.title, currentPage.id)
      : currentPage.slug;
    const nextRevision = currentPage.currentRevision + 1;

    const [updatedPage] = await db
      .update(documentPages)
      .set({
        title: nextTitle,
        slug: nextSlug,
        icon: data.icon === undefined ? currentPage.icon : data.icon,
        contentJson: nextContentJson,
        contentText: nextContentText,
        excerpt: nextExcerpt,
        currentRevision: nextRevision,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(
        and(
          eq(documentPages.id, currentPage.id),
          eq(documentPages.currentRevision, data.expectedRevision)
        )
      )
      .returning();

    if (!updatedPage) {
      return NextResponse.json(
        { error: 'This page has changed since you opened it', currentRevision: currentPage.currentRevision },
        { status: 409 }
      );
    }

    await db.insert(documentPageRevisions).values({
      pageId: updatedPage.id,
      revision: nextRevision,
      title: updatedPage.title,
      contentJson: updatedPage.contentJson,
      contentText: updatedPage.contentText,
      excerpt: updatedPage.excerpt,
      changeSummary: data.changeSummary || 'Updated page',
      createdBy: session.user.id,
    });

    await replaceDocumentLinks(updatedPage.id, extractInternalDocumentLinkIds(nextContentJson), session.user.id);

    await createAuditLog({
      userId: session.user.id,
      organizationId: updatedPage.organizationId,
      action: 'document.updated',
      resourceType: 'document',
      resourceId: updatedPage.id,
      projectId: updatedPage.projectId || undefined,
      metadata: { revision: nextRevision, changeSummary: data.changeSummary || null },
    });

    const responsePage = await buildDocumentPageResponse(session.user.id, updatedPage.id);
    if (!responsePage) {
      return NextResponse.json({ error: 'Failed to load updated document page' }, { status: 500 });
    }

    return NextResponse.json(responsePage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Error updating document page:', error);
    return NextResponse.json({ error: 'Failed to update document page' }, { status: 500 });
  }
}

export async function DELETE(
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

    if (!access?.permissions.canDelete) {
      return NextResponse.json({ error: 'You do not have permission to archive this page' }, { status: 403 });
    }

    const [page] = await db
      .update(documentPages)
      .set({
        isArchived: true,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(documentPages.id, pageId))
      .returning();

    await createAuditLog({
      userId: session.user.id,
      organizationId: access.organizationId,
      action: 'document.deleted',
      resourceType: 'document',
      resourceId: pageId,
      projectId: access.projectId || undefined,
      metadata: { archived: true },
    });

    return NextResponse.json({ success: true, page });
  } catch (error) {
    console.error('Error archiving document page:', error);
    return NextResponse.json({ error: 'Failed to archive document page' }, { status: 500 });
  }
}
