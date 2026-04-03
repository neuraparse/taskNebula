import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createAuditLog, db, documentPages, eq } from '@tasknebula/db';
import {
  buildDocumentPageResponse,
  canManageDocumentPublicShare,
  generateUniqueDocumentPublicShareToken,
  resolveDocumentPageAccess,
} from '@/lib/docs/server';

const updateShareSchema = z.object({
  enablePublic: z.boolean().optional(),
  allowSearchIndexing: z.boolean().optional(),
  includeAttachments: z.boolean().optional(),
  regenerateToken: z.boolean().optional(),
});

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

    if (!access?.permissions.canBrowse) {
      return NextResponse.json({ error: 'Page not found or unavailable' }, { status: 404 });
    }

    if (!canManageDocumentPublicShare(access)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage public sharing for this page' },
        { status: 403 }
      );
    }

    const data = updateShareSchema.parse(await request.json());
    const currentPage = access.page;
    const nextEnabled = data.enablePublic ?? currentPage.publicShareEnabled;
    const nextAllowSearchIndexing =
      data.allowSearchIndexing ?? currentPage.publicShareAllowSearchIndexing;
    const nextIncludeAttachments =
      data.includeAttachments ?? currentPage.publicShareIncludeAttachments;

    let nextToken = currentPage.publicShareToken;
    if (data.regenerateToken || (nextEnabled && !nextToken)) {
      nextToken = await generateUniqueDocumentPublicShareToken();
    }

    const nextPublishedAt = nextEnabled ? currentPage.publicSharePublishedAt || new Date() : null;
    const nextPublishedBy = nextEnabled ? currentPage.publicSharePublishedBy || session.user.id : null;

    await db
      .update(documentPages)
      .set({
        publicShareEnabled: nextEnabled,
        publicShareToken: nextToken,
        publicShareAllowSearchIndexing: nextAllowSearchIndexing,
        publicShareIncludeAttachments: nextIncludeAttachments,
        publicSharePublishedAt: nextPublishedAt,
        publicSharePublishedBy: nextPublishedBy,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(documentPages.id, pageId));

    if (!currentPage.publicShareEnabled && nextEnabled) {
      await createAuditLog({
        userId: session.user.id,
        organizationId: currentPage.organizationId,
        action: 'document.public_shared',
        resourceType: 'document',
        resourceId: currentPage.id,
        projectId: currentPage.projectId || undefined,
        metadata: {
          allowSearchIndexing: nextAllowSearchIndexing,
          includeAttachments: nextIncludeAttachments,
        },
      });
    }

    if (currentPage.publicShareEnabled && !nextEnabled) {
      await createAuditLog({
        userId: session.user.id,
        organizationId: currentPage.organizationId,
        action: 'document.public_unshared',
        resourceType: 'document',
        resourceId: currentPage.id,
        projectId: currentPage.projectId || undefined,
      });
    }

    if (data.regenerateToken) {
      await createAuditLog({
        userId: session.user.id,
        organizationId: currentPage.organizationId,
        action: 'document.public_link_regenerated',
        resourceType: 'document',
        resourceId: currentPage.id,
        projectId: currentPage.projectId || undefined,
      });
    }

    const responsePage = await buildDocumentPageResponse(session.user.id, currentPage.id);
    if (!responsePage) {
      return NextResponse.json({ error: 'Failed to load updated sharing state' }, { status: 500 });
    }

    return NextResponse.json(responsePage);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Error updating document sharing:', error);
    return NextResponse.json({ error: 'Failed to update document sharing' }, { status: 500 });
  }
}
