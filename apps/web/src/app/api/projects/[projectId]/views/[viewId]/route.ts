import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, organizationMembers, savedFilters } from '@tasknebula/db';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

type ViewScope = 'personal' | 'project' | 'teamspace';

const updateProjectViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(240).nullable().optional(),
  query: z.string().min(1).optional(),
  criteria: z.record(z.any()).optional(),
  viewType: z.enum(['list', 'board', 'timeline', 'calendar']).optional(),
  scope: z.enum(['personal', 'project', 'teamspace']).optional(),
  isPinned: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

function getViewScope(criteria: Record<string, any> | null | undefined): ViewScope {
  if (criteria?.scope === 'teamspace') {
    return 'teamspace';
  }

  if (criteria?.scope === 'personal') {
    return 'personal';
  }

  return 'project';
}

function getViewTeamspaceId(criteria: Record<string, any> | null | undefined) {
  return typeof criteria?.teamspaceId === 'string' && criteria.teamspaceId.length > 0
    ? criteria.teamspaceId
    : null;
}

function isDefaultView(criteria: Record<string, any> | null | undefined) {
  return criteria?.defaultView === true;
}

function serializeProjectView(view: typeof savedFilters.$inferSelect, viewerId: string) {
  const criteria = (view.criteria ?? {}) as Record<string, any>;
  const scope = getViewScope(criteria);

  return {
    ...view,
    scope,
    teamspaceId: scope === 'teamspace' ? getViewTeamspaceId(criteria) : null,
    isDefault: isDefaultView(criteria),
    isOwned: view.userId === viewerId,
  };
}

async function ensureProjectAccess(projectIdOrKey: string, userId: string) {
  const project = await resolveProjectByIdOrKey(projectIdOrKey);
  if (!project) {
    return { error: NextResponse.json({ error: 'Project not found' }, { status: 404 }) };
  }

  const [membership] = await db
    .select({
      id: organizationMembers.id,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!membership) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { project };
}

async function getOwnedView(projectId: string, viewId: string, userId: string) {
  const [view] = await db
    .select()
    .from(savedFilters)
    .where(
      and(
        eq(savedFilters.id, viewId),
        eq(savedFilters.projectId, projectId),
        eq(savedFilters.userId, userId)
      )
    )
    .limit(1);

  return view ?? null;
}

async function clearDefaultViewsForScope({
  organizationId,
  projectId,
  userId,
  scope,
  teamspaceId,
  excludeViewId,
}: {
  organizationId: string;
  projectId: string;
  userId: string;
  scope: ViewScope;
  teamspaceId?: string | null;
  excludeViewId?: string | null;
}) {
  const existingViews = await db
    .select()
    .from(savedFilters)
    .where(
      and(
        eq(savedFilters.organizationId, organizationId),
        eq(savedFilters.projectId, projectId),
        eq(savedFilters.userId, userId)
      )
    );

  const matchingViews = existingViews.filter((view) => {
    if (excludeViewId && view.id === excludeViewId) {
      return false;
    }

    const criteria = (view.criteria ?? {}) as Record<string, any>;
    const currentScope = getViewScope(criteria);
    const currentTeamspaceId = getViewTeamspaceId(criteria);

    if (currentScope !== scope) {
      return false;
    }

    if (scope === 'teamspace') {
      return currentTeamspaceId === (teamspaceId ?? null);
    }

    return true;
  });

  await Promise.all(
    matchingViews.map((view) =>
      db
        .update(savedFilters)
        .set({
          criteria: {
            ...((view.criteria ?? {}) as Record<string, any>),
            defaultView: false,
          } as any,
          updatedAt: new Date(),
        })
        .where(eq(savedFilters.id, view.id))
    )
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; viewId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, viewId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id);
  if ('error' in access) {
    return access.error;
  }

  const project = access.project;
  const existingView = await getOwnedView(project.id, viewId, session.user.id);
  if (!existingView) {
    return NextResponse.json({ error: 'View not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateProjectViewSchema.parse(body);

    const existingCriteria = (existingView.criteria ?? {}) as Record<string, any>;
    const nextScope = parsed.scope ?? getViewScope(existingCriteria);
    const nextCriteriaBase = {
      ...existingCriteria,
      ...(parsed.criteria ?? {}),
      scope: nextScope,
    };
    const nextTeamspaceId =
      nextScope === 'teamspace'
        ? getViewTeamspaceId(nextCriteriaBase) ?? request.nextUrl.searchParams.get('teamId')
        : null;

    if (nextScope === 'teamspace' && !nextTeamspaceId) {
      return NextResponse.json(
        { error: 'Teamspace-scoped views require an active teamspace.' },
        { status: 400 }
      );
    }

    const nextCriteria = {
      ...nextCriteriaBase,
      teamspaceId: nextScope === 'teamspace' ? nextTeamspaceId : null,
      defaultView:
        typeof parsed.isDefault === 'boolean' ? parsed.isDefault : isDefaultView(existingCriteria),
    };

    if (nextCriteria.defaultView) {
      await clearDefaultViewsForScope({
        organizationId: project.organizationId,
        projectId: project.id,
        userId: session.user.id,
        scope: nextScope,
        teamspaceId: nextTeamspaceId,
        excludeViewId: existingView.id,
      });
    }

    const [view] = await db
      .update(savedFilters)
      .set({
        name: parsed.name ?? existingView.name,
        description:
          parsed.description === undefined ? existingView.description : parsed.description,
        query: parsed.query ?? existingView.query,
        criteria: nextCriteria as any,
        viewType: parsed.viewType ?? existingView.viewType,
        isPublic:
          nextScope === 'personal' ? false : (parsed.isPublic ?? existingView.isPublic),
        isStarred:
          typeof parsed.isPinned === 'boolean' ? parsed.isPinned : existingView.isStarred,
        updatedAt: new Date(),
      })
      .where(eq(savedFilters.id, existingView.id))
      .returning();

    if (!view) {
      throw new Error('Failed to update view');
    }

    return NextResponse.json({ view: serializeProjectView(view, session.user.id) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid project view payload', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update project view error:', error);
    return NextResponse.json({ error: 'Failed to update view' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; viewId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId, viewId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id);
  if ('error' in access) {
    return access.error;
  }

  const existingView = await getOwnedView(access.project.id, viewId, session.user.id);
  if (!existingView) {
    return NextResponse.json({ error: 'View not found' }, { status: 404 });
  }

  try {
    await db.delete(savedFilters).where(eq(savedFilters.id, existingView.id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete project view error:', error);
    return NextResponse.json({ error: 'Failed to delete view' }, { status: 500 });
  }
}
