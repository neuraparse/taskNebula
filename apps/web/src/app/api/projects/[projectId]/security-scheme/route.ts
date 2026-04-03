import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueSecuritySchemes, projectSecuritySchemes } from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

async function getSecuritySchemeState(projectIdOrKey: string) {
  const project = await resolveProjectByIdOrKey(projectIdOrKey);
  if (!project) {
    return null;
  }

  const [assignment] = await db
    .select()
    .from(projectSecuritySchemes)
    .where(eq(projectSecuritySchemes.projectId, project.id))
    .limit(1);

  const [assignedScheme] = assignment
    ? await db
        .select({
          id: issueSecuritySchemes.id,
          name: issueSecuritySchemes.name,
          description: issueSecuritySchemes.description,
          isDefault: issueSecuritySchemes.isDefault,
        })
        .from(issueSecuritySchemes)
        .where(eq(issueSecuritySchemes.id, assignment.schemeId))
        .limit(1)
    : [null];

  const [defaultScheme] = await db
    .select({
      id: issueSecuritySchemes.id,
      name: issueSecuritySchemes.name,
      description: issueSecuritySchemes.description,
      isDefault: issueSecuritySchemes.isDefault,
    })
    .from(issueSecuritySchemes)
    .where(and(eq(issueSecuritySchemes.organizationId, project.organizationId), eq(issueSecuritySchemes.isDefault, true)))
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
    const state = await getSecuritySchemeState(projectId);
    if (!state) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(state);
  } catch (error) {
    console.error('Error fetching project security scheme:', error);
    return NextResponse.json({ error: 'Failed to fetch project security scheme' }, { status: 500 });
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
        .select({ id: issueSecuritySchemes.id })
        .from(issueSecuritySchemes)
        .where(and(eq(issueSecuritySchemes.id, schemeId), eq(issueSecuritySchemes.organizationId, project.organizationId)))
        .limit(1);

      if (!scheme) {
        return NextResponse.json({ error: 'Security scheme not found for this organization' }, { status: 404 });
      }
    }

    await db.delete(projectSecuritySchemes).where(eq(projectSecuritySchemes.projectId, project.id));

    if (schemeId) {
      await db.insert(projectSecuritySchemes).values({
        projectId: project.id,
        schemeId,
        createdBy: session.user.id,
      });
    }

    const state = await getSecuritySchemeState(project.id);
    return NextResponse.json(state);
  } catch (error) {
    console.error('Error updating project security scheme:', error);
    return NextResponse.json({ error: 'Failed to update project security scheme' }, { status: 500 });
  }
}
