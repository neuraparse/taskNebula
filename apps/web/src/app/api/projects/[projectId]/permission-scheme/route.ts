import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, permissionSchemes, projectPermissionSchemes } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

async function getPermissionSchemeState(projectIdOrKey: string) {
  const project = await resolveProjectByIdOrKey(projectIdOrKey);
  if (!project) {
    return null;
  }

  const [assignment] = await db
    .select()
    .from(projectPermissionSchemes)
    .where(eq(projectPermissionSchemes.projectId, project.id))
    .limit(1);

  const [assignedScheme] = assignment
    ? await db
        .select({
          id: permissionSchemes.id,
          name: permissionSchemes.name,
          description: permissionSchemes.description,
          isDefault: permissionSchemes.isDefault,
        })
        .from(permissionSchemes)
        .where(eq(permissionSchemes.id, assignment.schemeId))
        .limit(1)
    : [null];

  const [defaultScheme] = await db
    .select({
      id: permissionSchemes.id,
      name: permissionSchemes.name,
      description: permissionSchemes.description,
      isDefault: permissionSchemes.isDefault,
    })
    .from(permissionSchemes)
    .where(and(eq(permissionSchemes.organizationId, project.organizationId), eq(permissionSchemes.isDefault, true)))
    .limit(1);

  const effectiveScheme = assignedScheme ?? defaultScheme ?? null;

  return {
    projectId: project.id,
    assignedSchemeId: assignment?.schemeId ?? null,
    effectiveSchemeId: effectiveScheme?.id ?? null,
    source: assignedScheme ? 'project' : defaultScheme ? 'organization-default' : 'none',
    scheme: effectiveScheme,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const state = await getPermissionSchemeState(projectId);
    if (!state) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching project permission scheme:', error);
    return NextResponse.json({ error: 'Failed to fetch project permission scheme' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const body = await request.json();
    const schemeId = body?.schemeId ?? null;
    const project = await resolveProjectByIdOrKey(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (schemeId) {
      const [scheme] = await db
        .select({ id: permissionSchemes.id })
        .from(permissionSchemes)
        .where(and(eq(permissionSchemes.id, schemeId), eq(permissionSchemes.organizationId, project.organizationId)))
        .limit(1);

      if (!scheme) {
        return NextResponse.json({ error: 'Permission scheme not found for this organization' }, { status: 404 });
      }
    }

    await db.delete(projectPermissionSchemes).where(eq(projectPermissionSchemes.projectId, project.id));

    if (schemeId) {
      await db.insert(projectPermissionSchemes).values({
        projectId: project.id,
        schemeId,
        createdBy: session.user.id,
      });
    }

    const state = await getPermissionSchemeState(project.id);
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error updating project permission scheme:', error);
    return NextResponse.json({ error: 'Failed to update project permission scheme' }, { status: 500 });
  }
}
