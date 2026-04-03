import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createId } from '@paralleldrive/cuid2';
import {
  and,
  createAuditLog,
  db,
  documentPages,
  eq,
  getIssueById,
  issueDocumentLinks,
  issues,
} from '@tasknebula/db';
import {
  buildDocumentPageResponse,
  createInitialRevision,
  ensureProjectDocumentSpace,
  ensureUniqueDocumentSlug,
  getNextDocumentPosition,
  getProjectDocumentPermissions,
  getUserFlags,
  replaceDocumentLinks,
  resolveDocumentPageAccess,
} from '@/lib/docs/server';
import {
  createIssueSpecDocumentContent,
  extractDocumentExcerpt,
  extractDocumentText,
  extractInternalDocumentLinkIds,
} from '@/lib/docs/content';

const attachDocSchema = z.object({
  pageId: z.string().optional(),
  createNew: z.boolean().optional(),
  title: z.string().min(1).max(500).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { issueId } = await params;
    const issue = await getIssueById(issueId);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    const rawDocs = await db
      .select({
        linkId: issueDocumentLinks.id,
        id: documentPages.id,
        spaceId: documentPages.spaceId,
        title: documentPages.title,
        icon: documentPages.icon,
        slug: documentPages.slug,
        excerpt: documentPages.excerpt,
        projectId: documentPages.projectId,
        updatedAt: documentPages.updatedAt,
      })
      .from(issueDocumentLinks)
      .innerJoin(documentPages, eq(issueDocumentLinks.pageId, documentPages.id))
      .where(and(eq(issueDocumentLinks.issueId, issueId), eq(documentPages.isArchived, false)));

    const docs = [];
    for (const doc of rawDocs) {
      const pageAccess = await resolveDocumentPageAccess(session.user.id, doc.id);
      if (pageAccess?.permissions.canBrowse) {
        docs.push(doc);
      }
    }

    return NextResponse.json({ docs });
  } catch (error) {
    console.error('Error fetching issue docs:', error);
    return NextResponse.json({ error: 'Failed to fetch issue docs' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { issueId } = await params;
    const issue = await getIssueById(issueId);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = attachDocSchema.parse(body);
    const { isSuperAdmin } = await getUserFlags(session.user.id);
    const projectPermissions = await getProjectDocumentPermissions(session.user.id, issue.projectId, isSuperAdmin);

    if (!projectPermissions.canBrowse) {
      return NextResponse.json({ error: 'You do not have permission to browse docs for this issue' }, { status: 403 });
    }

    if (data.pageId) {
      const pageAccess = await resolveDocumentPageAccess(session.user.id, data.pageId);
      if (!pageAccess?.permissions.canBrowse || !projectPermissions.canEdit) {
        return NextResponse.json({ error: 'You do not have permission to attach this document' }, { status: 403 });
      }

      const [existing] = await db
        .select()
        .from(issueDocumentLinks)
        .where(and(eq(issueDocumentLinks.issueId, issueId), eq(issueDocumentLinks.pageId, data.pageId)))
        .limit(1);

      if (existing) {
        return NextResponse.json({ error: 'Document is already attached to this issue' }, { status: 409 });
      }

      const [link] = await db
        .insert(issueDocumentLinks)
        .values({
          id: createId(),
          issueId,
          pageId: data.pageId,
          createdBy: session.user.id,
          updatedBy: session.user.id,
        })
        .returning();

      if (!link) {
        return NextResponse.json({ error: 'Failed to attach document' }, { status: 500 });
      }

      await createAuditLog({
        userId: session.user.id,
        organizationId: issue.organizationId,
        action: 'document.linked_issue',
        resourceType: 'document',
        resourceId: data.pageId,
        projectId: issue.projectId,
        issueId,
        metadata: { linkId: link.id },
      });

      return NextResponse.json(link, { status: 201 });
    }

    if (!data.createNew) {
      return NextResponse.json({ error: 'pageId or createNew is required' }, { status: 400 });
    }

    if (!projectPermissions.canCreate) {
      return NextResponse.json({ error: 'You do not have permission to create project docs' }, { status: 403 });
    }

    const space = await ensureProjectDocumentSpace(issue.projectId, session.user.id);
    if (!space) {
      return NextResponse.json({ error: 'Project document space not found' }, { status: 404 });
    }

    const title = data.title || `${issue.key} Spec`;
    const contentJson = createIssueSpecDocumentContent(issue);
    const contentText = extractDocumentText(contentJson);
    const excerpt = extractDocumentExcerpt(contentJson);
    const slug = await ensureUniqueDocumentSlug(space.id, null, title);
    const position = await getNextDocumentPosition(space.id, null);
    const pageId = createId();

    const [page] = await db
      .insert(documentPages)
      .values({
        id: pageId,
        spaceId: space.id,
        organizationId: issue.organizationId,
        projectId: issue.projectId,
        parentId: null,
        title,
        icon: '🧩',
        slug,
        contentJson,
        contentText,
        excerpt,
        currentRevision: 1,
        position,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    if (!page) {
      return NextResponse.json({ error: 'Failed to create document page' }, { status: 500 });
    }

    await createInitialRevision({
      pageId,
      title,
      contentJson,
      contentText,
      excerpt,
      changeSummary: `Created from issue ${issue.key}`,
      userId: session.user.id,
    });
    await replaceDocumentLinks(pageId, extractInternalDocumentLinkIds(contentJson), session.user.id);

    const [link] = await db
      .insert(issueDocumentLinks)
      .values({
        id: createId(),
        issueId,
        pageId,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    if (!link) {
      return NextResponse.json({ error: 'Failed to attach document to issue' }, { status: 500 });
    }

    await createAuditLog({
      userId: session.user.id,
      organizationId: issue.organizationId,
      action: 'document.created',
      resourceType: 'document',
      resourceId: pageId,
      projectId: issue.projectId,
      issueId,
      metadata: { sourceIssueId: issueId, linkId: link.id },
    });

    const responsePage = await buildDocumentPageResponse(session.user.id, pageId);
    if (!responsePage) {
      return NextResponse.json({ error: 'Failed to load created document page' }, { status: 500 });
    }

    return NextResponse.json({ page: responsePage, link }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Error attaching doc to issue:', error);
    return NextResponse.json({ error: 'Failed to attach doc to issue' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { issueId } = await params;
    const issue = await getIssueById(issueId);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('pageId');
    if (!pageId) {
      return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
    }

    const { isSuperAdmin } = await getUserFlags(session.user.id);
    const projectPermissions = await getProjectDocumentPermissions(session.user.id, issue.projectId, isSuperAdmin);
    if (!projectPermissions.canEdit) {
      return NextResponse.json({ error: 'You do not have permission to unlink docs from this issue' }, { status: 403 });
    }

    const [deleted] = await db
      .delete(issueDocumentLinks)
      .where(and(eq(issueDocumentLinks.issueId, issueId), eq(issueDocumentLinks.pageId, pageId)))
      .returning();

    await createAuditLog({
      userId: session.user.id,
      organizationId: issue.organizationId,
      action: 'document.unlinked_issue',
      resourceType: 'document',
      resourceId: pageId,
      projectId: issue.projectId,
      issueId,
      metadata: { linkId: deleted?.id || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unlinking doc from issue:', error);
    return NextResponse.json({ error: 'Failed to unlink doc from issue' }, { status: 500 });
  }
}
