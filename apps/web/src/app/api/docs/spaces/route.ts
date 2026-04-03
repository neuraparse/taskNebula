import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { createId } from '@paralleldrive/cuid2';
import { db, documentSpaces, projects, eq } from '@tasknebula/db';
import {
  ensureProjectDocumentSpace,
  getOrgDocumentPermissions,
  getOrganizationRole,
  getUserFlags,
  listAccessibleDocumentSpaces,
  resolveOrganizationIdForUser,
  resolveProjectId,
} from '@/lib/docs/server';
import { slugifyDocumentTitle } from '@/lib/docs/content';

const createSpaceSchema = z.object({
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  scope: z.enum(['organization', 'project']).default('organization'),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationIdParam = searchParams.get('organizationId');
  const projectIdParam = searchParams.get('projectId');

  try {
    const resolvedProjectId = projectIdParam ? await resolveProjectId(projectIdParam) : null;
    let organizationId = await resolveOrganizationIdForUser(session.user.id, organizationIdParam);

    if (resolvedProjectId) {
      const [project] = await db
        .select({ organizationId: projects.organizationId })
        .from(projects)
        .where(eq(projects.id, resolvedProjectId))
        .limit(1);

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      organizationId = project.organizationId;
    }

    if (!organizationId) {
      return NextResponse.json({ spaces: [] });
    }

    const spaces = await listAccessibleDocumentSpaces(session.user.id, organizationId, resolvedProjectId);
    return NextResponse.json({ spaces });
  } catch (error) {
    console.error('Error fetching document spaces:', error);
    return NextResponse.json({ error: 'Failed to fetch document spaces' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createSpaceSchema.parse(body);
    const { isSuperAdmin } = await getUserFlags(session.user.id);

    if (data.scope === 'project') {
      if (!data.projectId) {
        return NextResponse.json({ error: 'projectId is required for project spaces' }, { status: 400 });
      }

      const projectId = await resolveProjectId(data.projectId);
      if (!projectId) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const space = await ensureProjectDocumentSpace(projectId, session.user.id);
      if (!space) {
        return NextResponse.json({ error: 'Failed to create project space' }, { status: 500 });
      }

      return NextResponse.json(space, { status: 201 });
    }

    const organizationId = await resolveOrganizationIdForUser(session.user.id, data.organizationId);
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const orgRole = await getOrganizationRole(session.user.id, organizationId);
    const permissions = getOrgDocumentPermissions(orgRole, isSuperAdmin);
    if (!permissions.canCreate) {
      return NextResponse.json({ error: 'You do not have permission to create document spaces' }, { status: 403 });
    }

    const slug = slugifyDocumentTitle(data.name);
    const [space] = await db
      .insert(documentSpaces)
      .values({
        id: createId(),
        organizationId,
        projectId: null,
        scope: 'organization',
        name: data.name,
        slug,
        description: data.description || null,
        isDefault: false,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }

    console.error('Error creating document space:', error);
    return NextResponse.json({ error: 'Failed to create document space' }, { status: 500 });
  }
}
