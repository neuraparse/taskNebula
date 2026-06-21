import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';
import {
  ROLE_DEFAULT_PERMISSIONS,
  and,
  db,
  desc,
  documentPageAttachments,
  issueDocumentLinks,
  issues,
  documentPages,
  documentSpaces,
  documentPageRevisions,
  documentPageLinks,
  eq,
  organizationMembers,
  projectMembers,
  projects,
  sql,
  users,
  hasPermission as roleHasPermission,
  type ProjectRole,
} from '@tasknebula/db';
import {
  createPublicDocumentHref,
  sanitizePublicDocumentContent,
  slugifyDocumentTitle,
} from './content';

export type OrgDocumentRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest' | null;
type DocumentSpaceRecord = typeof documentSpaces.$inferSelect;
type DocumentPageRecord = typeof documentPages.$inferSelect;

export interface DocumentPermissionSet {
  canBrowse: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface DocumentShareSettings {
  canManagePublic: boolean;
  internalPath: string;
  public: {
    enabled: boolean;
    urlPath: string | null;
    allowSearchIndexing: boolean;
    includeAttachments: boolean;
    publishedAt: string | null;
  };
}

export async function resolveProjectId(projectIdOrKey: string) {
  if (projectIdOrKey.length > 10 || projectIdOrKey.includes('_')) {
    return projectIdOrKey;
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.key, projectIdOrKey.toUpperCase()))
    .limit(1);

  return project?.id || null;
}

export async function getUserFlags(userId: string) {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    isSuperAdmin: user?.isSuperAdmin || false,
  };
}

export async function getOrganizationRole(
  userId: string,
  organizationId: string
): Promise<OrgDocumentRole> {
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  return (member?.role as OrgDocumentRole) || null;
}

export async function resolveOrganizationIdForUser(userId: string, organizationId?: string | null) {
  if (organizationId) {
    return organizationId;
  }

  const [membership] = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.status, 'active')))
    .limit(1);

  return membership?.organizationId || null;
}

export function getOrgDocumentPermissions(
  role: OrgDocumentRole,
  isSuperAdmin = false
): DocumentPermissionSet {
  if (roleHasPermission(role || '', 'org:settings', isSuperAdmin)) {
    return { canBrowse: true, canCreate: true, canEdit: true, canDelete: true };
  }

  if (role === 'member') {
    return { canBrowse: true, canCreate: true, canEdit: true, canDelete: false };
  }

  if (role === 'viewer') {
    return { canBrowse: true, canCreate: false, canEdit: false, canDelete: false };
  }

  return { canBrowse: false, canCreate: false, canEdit: false, canDelete: false };
}

export async function getProjectDocumentPermissions(
  userId: string,
  projectId: string,
  isSuperAdmin = false
): Promise<DocumentPermissionSet> {
  if (isSuperAdmin) {
    return { canBrowse: true, canCreate: true, canEdit: true, canDelete: true };
  }

  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { canBrowse: false, canCreate: false, canEdit: false, canDelete: false };
  }

  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  if (roleHasPermission(orgMember?.role || '', 'project:manage')) {
    return { canBrowse: true, canCreate: true, canEdit: true, canDelete: true };
  }

  const [member] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!member) {
    return { canBrowse: false, canCreate: false, canEdit: false, canDelete: false };
  }

  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[member.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  const toBool = (value: string | null | undefined) => value === 'true';

  return {
    canBrowse:
      (toBool(member.canBrowseProject) || roleDefaults.canBrowseProject) &&
      (toBool(member.canBrowseDocs) || roleDefaults.canBrowseDocs),
    canCreate: toBool(member.canCreateDocs) || roleDefaults.canCreateDocs,
    canEdit: toBool(member.canEditDocs) || roleDefaults.canEditDocs,
    canDelete: toBool(member.canDeleteDocs) || roleDefaults.canDeleteDocs,
  };
}

export async function ensureOrganizationDocumentSpace(
  organizationId: string,
  userId: string
): Promise<DocumentSpaceRecord | null> {
  const defaultSlug = 'team-wiki';
  const [existing] = await db
    .select()
    .from(documentSpaces)
    .where(
      and(
        eq(documentSpaces.organizationId, organizationId),
        eq(documentSpaces.scope, 'organization'),
        eq(documentSpaces.isDefault, true)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [space] = await db
    .insert(documentSpaces)
    .values({
      id: createId(),
      organizationId,
      projectId: null,
      scope: 'organization',
      name: 'Team Wiki',
      slug: defaultSlug,
      description: 'Shared organization knowledge base',
      isDefault: true,
      createdBy: userId,
      updatedBy: userId,
    })
    .onConflictDoNothing({
      target: [documentSpaces.organizationId, documentSpaces.scope, documentSpaces.slug],
    })
    .returning();

  if (space) {
    return space;
  }

  const [conflictingSpace] = await db
    .select()
    .from(documentSpaces)
    .where(
      and(
        eq(documentSpaces.organizationId, organizationId),
        eq(documentSpaces.scope, 'organization'),
        eq(documentSpaces.slug, defaultSlug)
      )
    )
    .limit(1);

  return conflictingSpace ?? null;
}

export async function ensureProjectDocumentSpace(
  projectId: string,
  userId: string
): Promise<DocumentSpaceRecord | null> {
  const [existing] = await db
    .select()
    .from(documentSpaces)
    .where(and(eq(documentSpaces.projectId, projectId), eq(documentSpaces.scope, 'project')))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      key: projects.key,
      organizationId: projects.organizationId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return null;
  }

  const [space] = await db
    .insert(documentSpaces)
    .values({
      id: createId(),
      organizationId: project.organizationId,
      projectId: project.id,
      scope: 'project',
      name: `${project.name} Docs`,
      slug: `${project.key.toLowerCase()}-docs`,
      description: `Project documentation for ${project.name}`,
      isDefault: true,
      createdBy: userId,
      updatedBy: userId,
    })
    .onConflictDoNothing({
      target: [documentSpaces.organizationId, documentSpaces.scope, documentSpaces.slug],
    })
    .returning();

  if (space) {
    return space;
  }

  const [conflictingSpace] = await db
    .select()
    .from(documentSpaces)
    .where(
      and(
        eq(documentSpaces.organizationId, project.organizationId),
        eq(documentSpaces.scope, 'project'),
        eq(documentSpaces.slug, `${project.key.toLowerCase()}-docs`)
      )
    )
    .limit(1);

  return conflictingSpace ?? null;
}

export async function listAccessibleDocumentSpaces(
  userId: string,
  organizationId: string,
  projectId?: string | null
) {
  const { isSuperAdmin } = await getUserFlags(userId);
  const orgRole = await getOrganizationRole(userId, organizationId);
  const spaces: Array<{
    id: string;
    organizationId: string;
    projectId: string | null;
    scope: 'organization' | 'project';
    name: string;
    slug: string;
    description: string | null;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string;
    permissions: DocumentPermissionSet;
  }> = [];

  const orgPermissions = getOrgDocumentPermissions(orgRole, isSuperAdmin);
  if (orgPermissions.canBrowse) {
    const orgSpace = await ensureOrganizationDocumentSpace(organizationId, userId);
    if (orgSpace) {
      spaces.push({
        ...orgSpace,
        permissions: orgPermissions,
      });
    }
  }

  const accessibleProjects = new Map<string, DocumentPermissionSet>();

  if (projectId) {
    const permissions = await getProjectDocumentPermissions(userId, projectId, isSuperAdmin);
    if (permissions.canBrowse) {
      accessibleProjects.set(projectId, permissions);
    }
  } else if (isSuperAdmin || orgRole === 'owner') {
    const allProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));

    for (const project of allProjects) {
      accessibleProjects.set(project.id, {
        canBrowse: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      });
    }
  } else {
    const memberships = await db
      .select({
        projectId: projectMembers.projectId,
        role: projectMembers.role,
        canBrowseProject: projectMembers.canBrowseProject,
        canBrowseDocs: projectMembers.canBrowseDocs,
        canCreateDocs: projectMembers.canCreateDocs,
        canEditDocs: projectMembers.canEditDocs,
        canDeleteDocs: projectMembers.canDeleteDocs,
      })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(and(eq(projectMembers.userId, userId), eq(projects.organizationId, organizationId)));

    const toBool = (value: string | null | undefined) => value === 'true';

    for (const membership of memberships) {
      const roleDefaults =
        ROLE_DEFAULT_PERMISSIONS[membership.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
      const permissions = {
        canBrowse:
          (toBool(membership.canBrowseProject) || roleDefaults.canBrowseProject) &&
          (toBool(membership.canBrowseDocs) || roleDefaults.canBrowseDocs),
        canCreate: toBool(membership.canCreateDocs) || roleDefaults.canCreateDocs,
        canEdit: toBool(membership.canEditDocs) || roleDefaults.canEditDocs,
        canDelete: toBool(membership.canDeleteDocs) || roleDefaults.canDeleteDocs,
      };

      if (permissions.canBrowse) {
        accessibleProjects.set(membership.projectId, permissions);
      }
    }
  }

  for (const [accessibleProjectId, permissions] of accessibleProjects.entries()) {
    const space = await ensureProjectDocumentSpace(accessibleProjectId, userId);
    if (space) {
      spaces.push({
        ...space,
        permissions,
      });
    }
  }

  return spaces;
}

export async function resolveDocumentSpaceAccess(userId: string, spaceId: string) {
  const { isSuperAdmin } = await getUserFlags(userId);
  const [space] = await db
    .select()
    .from(documentSpaces)
    .where(eq(documentSpaces.id, spaceId))
    .limit(1);

  if (!space) {
    return null;
  }

  if (space.scope === 'organization') {
    const role = await getOrganizationRole(userId, space.organizationId);
    return {
      space,
      projectId: null,
      organizationId: space.organizationId,
      permissions: getOrgDocumentPermissions(role, isSuperAdmin),
      isSuperAdmin,
      orgRole: role,
    };
  }

  const permissions = await getProjectDocumentPermissions(userId, space.projectId!, isSuperAdmin);
  const role = await getOrganizationRole(userId, space.organizationId);

  return {
    space,
    projectId: space.projectId,
    organizationId: space.organizationId,
    permissions,
    isSuperAdmin,
    orgRole: role,
  };
}

export async function resolveDocumentPageAccess(userId: string, pageId: string) {
  const [page] = await db.select().from(documentPages).where(eq(documentPages.id, pageId)).limit(1);

  if (!page) {
    return null;
  }

  const access = await resolveDocumentSpaceAccess(userId, page.spaceId);
  if (!access) {
    return null;
  }

  return {
    ...access,
    page,
  };
}

export function canManageDocumentPublicShare(
  access:
    | {
        permissions: DocumentPermissionSet;
        isSuperAdmin?: boolean;
        orgRole?: OrgDocumentRole;
      }
    | null
    | undefined
) {
  if (!access) {
    return false;
  }

  return Boolean(
    access.isSuperAdmin ||
      access.orgRole === 'owner' ||
      access.orgRole === 'admin' ||
      access.permissions.canDelete
  );
}

export function buildDocumentShareSettings(
  page: Pick<
    DocumentPageRecord,
    | 'id'
    | 'spaceId'
    | 'projectId'
    | 'publicShareEnabled'
    | 'publicShareToken'
    | 'publicShareAllowSearchIndexing'
    | 'publicShareIncludeAttachments'
    | 'publicSharePublishedAt'
  >,
  canManagePublic: boolean
): DocumentShareSettings {
  const publicUrlPath =
    page.publicShareEnabled && page.publicShareToken
      ? createPublicDocumentHref(page.publicShareToken)
      : null;

  return {
    canManagePublic,
    internalPath: page.projectId
      ? `/projects/${page.projectId}/docs?pageId=${page.id}&spaceId=${page.spaceId}`
      : `/docs?pageId=${page.id}&spaceId=${page.spaceId}`,
    public: {
      enabled: page.publicShareEnabled,
      urlPath: canManagePublic || publicUrlPath ? publicUrlPath : null,
      allowSearchIndexing: page.publicShareAllowSearchIndexing,
      includeAttachments: page.publicShareIncludeAttachments,
      publishedAt: page.publicSharePublishedAt ? page.publicSharePublishedAt.toISOString() : null,
    },
  };
}

export async function buildDocumentPageResponse(userId: string, pageId: string) {
  const access = await resolveDocumentPageAccess(userId, pageId);
  if (!access?.permissions.canBrowse) {
    return null;
  }

  const page = access.page;

  const rawBacklinks = await db
    .select({
      id: documentPages.id,
      title: documentPages.title,
      slug: documentPages.slug,
      projectId: documentPages.projectId,
    })
    .from(documentPageLinks)
    .innerJoin(documentPages, eq(documentPageLinks.sourcePageId, documentPages.id))
    .where(and(eq(documentPageLinks.targetPageId, page.id), eq(documentPages.isArchived, false)));

  const backlinks = [];
  for (const backlink of rawBacklinks) {
    const backlinkAccess = await resolveDocumentPageAccess(userId, backlink.id);
    if (backlinkAccess?.permissions.canBrowse) {
      backlinks.push(backlink);
    }
  }

  const relatedIssues = await db
    .select({
      linkId: issueDocumentLinks.id,
      id: issues.id,
      key: issues.key,
      title: issues.title,
      projectId: issues.projectId,
      priority: issues.priority,
      statusId: issues.statusId,
    })
    .from(issueDocumentLinks)
    .innerJoin(issues, eq(issueDocumentLinks.issueId, issues.id))
    .where(eq(issueDocumentLinks.pageId, page.id));

  const attachments = await db
    .select()
    .from(documentPageAttachments)
    .where(eq(documentPageAttachments.pageId, page.id));

  const [revisionStats] = await db
    .select({
      revisionCount: sql<number>`count(*)::int`,
    })
    .from(documentPageRevisions)
    .where(eq(documentPageRevisions.pageId, page.id));

  const canManagePublic = canManageDocumentPublicShare(access);

  return {
    ...page,
    space: access.space,
    permissions: access.permissions,
    backlinks,
    relatedIssues,
    attachments,
    revisionCount: revisionStats?.revisionCount || 0,
    share: buildDocumentShareSettings(page, canManagePublic),
  };
}

export async function createInitialRevision(params: {
  pageId: string;
  title: string;
  contentJson: Record<string, unknown>;
  contentText: string;
  excerpt: string;
  changeSummary?: string | null;
  userId: string;
}) {
  const [revision] = await db
    .insert(documentPageRevisions)
    .values({
      id: createId(),
      pageId: params.pageId,
      revision: 1,
      title: params.title,
      contentJson: params.contentJson,
      contentText: params.contentText,
      excerpt: params.excerpt,
      changeSummary: params.changeSummary || 'Initial draft',
      createdBy: params.userId,
    })
    .returning();

  return revision;
}

export async function getNextDocumentPosition(spaceId: string, parentId: string | null) {
  const [row] = await db
    .select({
      nextPosition: sql<number>`coalesce(max(${documentPages.position}), -1) + 1`,
    })
    .from(documentPages)
    .where(
      parentId
        ? and(eq(documentPages.spaceId, spaceId), eq(documentPages.parentId, parentId))
        : and(eq(documentPages.spaceId, spaceId), sql`${documentPages.parentId} is null`)
    );

  return row?.nextPosition ?? 0;
}

export async function ensureUniqueDocumentSlug(
  spaceId: string,
  parentId: string | null,
  title: string,
  excludePageId?: string
) {
  const baseSlug = slugifyDocumentTitle(title);
  let slug = baseSlug;
  let suffix = 1;

  for (;;) {
    const conditions = [
      eq(documentPages.spaceId, spaceId),
      eq(documentPages.slug, slug),
      parentId ? eq(documentPages.parentId, parentId) : sql`${documentPages.parentId} is null`,
    ];

    if (excludePageId) {
      conditions.push(sql`${documentPages.id} <> ${excludePageId}`);
    }

    const [existing] = await db
      .select({ id: documentPages.id })
      .from(documentPages)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      return slug;
    }

    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }
}

export async function getLatestRevision(pageId: string) {
  const [revision] = await db
    .select()
    .from(documentPageRevisions)
    .where(eq(documentPageRevisions.pageId, pageId))
    .orderBy(desc(documentPageRevisions.revision))
    .limit(1);

  return revision || null;
}

export async function replaceDocumentLinks(
  pageId: string,
  linkedPageIds: string[],
  userId: string
) {
  const uniquePageIds = [...new Set(linkedPageIds)].filter(
    (linkedPageId) => linkedPageId && linkedPageId !== pageId
  );

  await db.delete(documentPageLinks).where(eq(documentPageLinks.sourcePageId, pageId));

  if (uniquePageIds.length === 0) {
    return;
  }

  await db.insert(documentPageLinks).values(
    uniquePageIds.map((linkedPageId) => ({
      id: createId(),
      sourcePageId: pageId,
      targetPageId: linkedPageId,
      createdBy: userId,
      updatedBy: userId,
    }))
  );
}

export async function generateUniqueDocumentPublicShareToken() {
  for (;;) {
    const token = crypto.randomBytes(24).toString('base64url');
    const [existingPage] = await db
      .select({ id: documentPages.id })
      .from(documentPages)
      .where(eq(documentPages.publicShareToken, token))
      .limit(1);

    if (!existingPage) {
      return token;
    }
  }
}

export async function getPublicDocumentByToken(token: string) {
  const [page] = await db
    .select()
    .from(documentPages)
    .where(
      and(
        eq(documentPages.publicShareToken, token),
        eq(documentPages.publicShareEnabled, true),
        eq(documentPages.isArchived, false)
      )
    )
    .limit(1);

  if (!page) {
    return null;
  }

  const attachments = await db
    .select()
    .from(documentPageAttachments)
    .where(eq(documentPageAttachments.pageId, page.id));

  const publicLinkTargets = await db
    .select({
      id: documentPages.id,
      publicShareToken: documentPages.publicShareToken,
    })
    .from(documentPages)
    .where(eq(documentPages.publicShareEnabled, true));

  const pageShareTokensById = new Map(
    publicLinkTargets
      .filter((entry) => entry.publicShareToken)
      .map((entry) => [entry.id, entry.publicShareToken as string])
  );

  const attachmentUrlByPath = new Map(
    attachments.map((attachment) => [
      attachment.filePath,
      `/api/public/docs/${token}/assets/${attachment.id}`,
    ])
  );

  const sanitizedContent = sanitizePublicDocumentContent(page.contentJson, {
    pageShareTokensById,
    attachmentUrlByPath,
    allowAttachments: page.publicShareIncludeAttachments,
  });

  return {
    id: page.id,
    title: page.title,
    slug: page.slug,
    excerpt: page.excerpt,
    updatedAt: page.updatedAt.toISOString(),
    publishedAt: page.publicSharePublishedAt ? page.publicSharePublishedAt.toISOString() : null,
    allowSearchIndexing: page.publicShareAllowSearchIndexing,
    includeAttachments: page.publicShareIncludeAttachments,
    contentJson: sanitizedContent,
    attachments: page.publicShareIncludeAttachments
      ? attachments.map((attachment) => ({
          id: attachment.id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          publicUrl: `/api/public/docs/${token}/assets/${attachment.id}`,
        }))
      : [],
  };
}
