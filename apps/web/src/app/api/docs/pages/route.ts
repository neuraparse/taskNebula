import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createId } from '@paralleldrive/cuid2';
import { and, createAuditLog, db, documentPages, eq } from '@tasknebula/db';
import {
  buildDocumentPageResponse,
  createInitialRevision,
  ensureOrganizationDocumentSpace,
  ensureProjectDocumentSpace,
  ensureUniqueDocumentSlug,
  getNextDocumentPosition,
  getOrganizationRole,
  getOrgDocumentPermissions,
  getProjectDocumentPermissions,
  getUserFlags,
  resolveDocumentSpaceAccess,
  resolveOrganizationIdForUser,
  resolveProjectId,
  replaceDocumentLinks,
} from '@/lib/docs/server';
import {
  createDefaultDocumentContent,
  extractDocumentExcerpt,
  extractDocumentText,
  extractInternalDocumentLinkIds,
} from '@/lib/docs/content';

const createPageSchema = z.object({
  title: z.string().min(1).max(500),
  icon: z.string().max(50).nullable().optional(),
  parentId: z.string().nullable().optional(),
  spaceId: z.string().optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  changeSummary: z.string().max(500).optional(),
  contentJson: z.record(z.any()).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get('spaceId');
  const projectIdParam = searchParams.get('projectId');
  const organizationIdParam = searchParams.get('organizationId');

  try {
    let resolvedSpaceId = spaceId;

    if (!resolvedSpaceId && projectIdParam) {
      const projectId = await resolveProjectId(projectIdParam);
      if (!projectId) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const { isSuperAdmin } = await getUserFlags(session.user.id);
      const permissions = await getProjectDocumentPermissions(
        session.user.id,
        projectId,
        isSuperAdmin
      );
      if (!permissions.canBrowse) {
        return NextResponse.json(
          { error: 'You do not have permission to view project docs' },
          { status: 403 }
        );
      }

      const space = await ensureProjectDocumentSpace(projectId, session.user.id);
      if (!space) {
        return NextResponse.json(
          { error: 'Project docs space could not be created' },
          { status: 500 }
        );
      }

      resolvedSpaceId = space.id;
    }

    if (!resolvedSpaceId) {
      const organizationId = await resolveOrganizationIdForUser(
        session.user.id,
        organizationIdParam
      );
      if (!organizationId) {
        return NextResponse.json({ pages: [], space: null });
      }

      const { isSuperAdmin } = await getUserFlags(session.user.id);
      const orgRole = await getOrganizationRole(session.user.id, organizationId);
      const permissions = getOrgDocumentPermissions(orgRole, isSuperAdmin);
      if (!permissions.canBrowse) {
        return NextResponse.json({ pages: [], space: null });
      }

      const space = await ensureOrganizationDocumentSpace(organizationId, session.user.id);
      if (!space) {
        return NextResponse.json(
          { error: 'Organization docs space could not be created' },
          { status: 500 }
        );
      }

      resolvedSpaceId = space.id;
    }

    const access = await resolveDocumentSpaceAccess(session.user.id, resolvedSpaceId);
    if (!access?.permissions.canBrowse) {
      return NextResponse.json(
        { error: 'You do not have permission to view this document space' },
        { status: 403 }
      );
    }

    const pages = await db
      .select({
        id: documentPages.id,
        spaceId: documentPages.spaceId,
        organizationId: documentPages.organizationId,
        projectId: documentPages.projectId,
        parentId: documentPages.parentId,
        title: documentPages.title,
        slug: documentPages.slug,
        icon: documentPages.icon,
        excerpt: documentPages.excerpt,
        currentRevision: documentPages.currentRevision,
        position: documentPages.position,
        isArchived: documentPages.isArchived,
        createdAt: documentPages.createdAt,
        updatedAt: documentPages.updatedAt,
        createdBy: documentPages.createdBy,
        updatedBy: documentPages.updatedBy,
      })
      .from(documentPages)
      .where(and(eq(documentPages.spaceId, resolvedSpaceId), eq(documentPages.isArchived, false)))
      .orderBy(documentPages.position, documentPages.title);

    return NextResponse.json({
      space: access.space,
      permissions: access.permissions,
      pages,
    });
  } catch (error) {
    console.error('Error fetching document pages:', error);
    return NextResponse.json({ error: 'Failed to fetch document pages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createPageSchema.parse(body);
    const { isSuperAdmin } = await getUserFlags(session.user.id);

    let spaceId = data.spaceId || null;
    let organizationId = data.organizationId || null;
    let projectId: string | null = data.projectId || null;
    let permissions = null;

    if (spaceId) {
      const access = await resolveDocumentSpaceAccess(session.user.id, spaceId);
      if (!access?.permissions.canCreate) {
        return NextResponse.json(
          { error: 'You do not have permission to create pages in this space' },
          { status: 403 }
        );
      }

      organizationId = access.organizationId;
      projectId = access.projectId;
      permissions = access.permissions;
    } else if (projectId) {
      const resolvedProjectId = await resolveProjectId(projectId);
      if (!resolvedProjectId) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const projectPermissions = await getProjectDocumentPermissions(
        session.user.id,
        resolvedProjectId,
        isSuperAdmin
      );
      if (!projectPermissions.canCreate) {
        return NextResponse.json(
          { error: 'You do not have permission to create project docs' },
          { status: 403 }
        );
      }

      const projectSpace = await ensureProjectDocumentSpace(resolvedProjectId, session.user.id);
      if (!projectSpace) {
        return NextResponse.json({ error: 'Project space not found' }, { status: 404 });
      }

      spaceId = projectSpace.id;
      organizationId = projectSpace.organizationId;
      projectId = resolvedProjectId;
      permissions = projectPermissions;
    } else {
      organizationId = await resolveOrganizationIdForUser(session.user.id, organizationId);
      if (!organizationId) {
        return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
      }

      const orgRole = await getOrganizationRole(session.user.id, organizationId);
      const orgPermissions = getOrgDocumentPermissions(orgRole, isSuperAdmin);
      if (!orgPermissions.canCreate) {
        return NextResponse.json(
          { error: 'You do not have permission to create organization docs' },
          { status: 403 }
        );
      }

      const orgSpace = await ensureOrganizationDocumentSpace(organizationId, session.user.id);
      if (!orgSpace) {
        return NextResponse.json(
          { error: 'Organization docs space could not be created' },
          { status: 500 }
        );
      }

      spaceId = orgSpace.id;
      permissions = orgPermissions;
    }

    if (!spaceId || !organizationId || !permissions) {
      return NextResponse.json({ error: 'Unable to resolve document space' }, { status: 400 });
    }

    if (data.parentId) {
      const [parentPage] = await db
        .select({
          id: documentPages.id,
          spaceId: documentPages.spaceId,
        })
        .from(documentPages)
        .where(eq(documentPages.id, data.parentId))
        .limit(1);

      if (!parentPage || parentPage.spaceId !== spaceId) {
        return NextResponse.json({ error: 'Parent page not found in this space' }, { status: 400 });
      }
    }

    const contentJson = data.contentJson || createDefaultDocumentContent();
    const contentText = extractDocumentText(contentJson);
    const excerpt = extractDocumentExcerpt(contentJson);
    const slug = await ensureUniqueDocumentSlug(spaceId, data.parentId || null, data.title);
    const position = await getNextDocumentPosition(spaceId, data.parentId || null);
    const pageId = createId();

    const [page] = await db
      .insert(documentPages)
      .values({
        id: pageId,
        spaceId,
        organizationId,
        projectId,
        parentId: data.parentId || null,
        title: data.title,
        slug,
        icon: data.icon || null,
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
      title: page.title,
      contentJson: page.contentJson as Record<string, unknown>,
      contentText: page.contentText,
      excerpt: page.excerpt || '',
      changeSummary: data.changeSummary,
      userId: session.user.id,
    });

    await replaceDocumentLinks(
      pageId,
      extractInternalDocumentLinkIds(contentJson),
      session.user.id
    );

    await createAuditLog({
      userId: session.user.id,
      organizationId,
      action: 'document.created',
      resourceType: 'document',
      resourceId: pageId,
      projectId: projectId || undefined,
      metadata: { title: page.title, spaceId },
    });

    const responsePage = await buildDocumentPageResponse(session.user.id, pageId);
    if (!responsePage) {
      return NextResponse.json({ error: 'Failed to load created document page' }, { status: 500 });
    }

    return NextResponse.json(responsePage, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating document page:', error);
    return NextResponse.json({ error: 'Failed to create document page' }, { status: 500 });
  }
}
