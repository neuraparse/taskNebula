import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db, savedFilters, organizationMembers } from '@tasknebula/db';
import { and, desc, eq, or } from 'drizzle-orm';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';

type ViewScope = 'personal' | 'project' | 'teamspace';

const projectViewSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(240).optional(),
  query: z.string().min(1).optional(),
  criteria: z.record(z.any()),
  viewType: z.enum(['list', 'board', 'timeline', 'calendar']).default('list'),
  isPublic: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  scope: z.enum(['personal', 'project', 'teamspace']).default('project'),
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

async function clearDefaultViewsForScope({
  organizationId,
  projectId,
  userId,
  scope,
  teamspaceId,
}: {
  organizationId: string;
  projectId: string;
  userId: string;
  scope: ViewScope;
  teamspaceId?: string | null;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id);
  if ('error' in access) {
    return access.error;
  }

  const project = access.project;
  const includePublic = request.nextUrl.searchParams.get('includePublic') !== 'false';
  const activeTeamId = request.nextUrl.searchParams.get('teamId');

  const rawViews = await db
    .select()
    .from(savedFilters)
    .where(
      and(
        eq(savedFilters.organizationId, project.organizationId),
        eq(savedFilters.projectId, project.id),
        includePublic
          ? or(eq(savedFilters.userId, session.user.id), eq(savedFilters.isPublic, true))
          : eq(savedFilters.userId, session.user.id)
      )
    )
    .orderBy(desc(savedFilters.isStarred), desc(savedFilters.lastUsedAt), desc(savedFilters.updatedAt));

  const views = rawViews
    .map((view) => serializeProjectView(view, session.user.id))
    .filter((view) => {
      if (view.scope !== 'teamspace') {
        return true;
      }

      return Boolean(activeTeamId && view.teamspaceId === activeTeamId);
    })
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }

      if (left.isStarred !== right.isStarred) {
        return left.isStarred ? -1 : 1;
      }

      const leftLastUsed = left.lastUsedAt ? new Date(left.lastUsedAt).getTime() : 0;
      const rightLastUsed = right.lastUsedAt ? new Date(right.lastUsedAt).getTime() : 0;
      if (leftLastUsed !== rightLastUsed) {
        return rightLastUsed - leftLastUsed;
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });

  return NextResponse.json({
    viewerId: session.user.id,
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      teamId: project.teamId ?? null,
    },
    views,
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId, session.user.id);
  if ('error' in access) {
    return access.error;
  }

  const project = access.project;

  try {
    const body = await request.json();
    const parsed = projectViewSchema.parse(body);
    const nextScope = parsed.scope;
    const nextTeamspaceId =
      nextScope === 'teamspace'
        ? typeof parsed.criteria.teamspaceId === 'string' && parsed.criteria.teamspaceId.length > 0
          ? parsed.criteria.teamspaceId
          : request.nextUrl.searchParams.get('teamId')
        : null;

    if (nextScope === 'teamspace' && !nextTeamspaceId) {
      return NextResponse.json(
        { error: 'Teamspace-scoped views require an active teamspace.' },
        { status: 400 }
      );
    }

    if (parsed.isDefault) {
      await clearDefaultViewsForScope({
        organizationId: project.organizationId,
        projectId: project.id,
        userId: session.user.id,
        scope: nextScope,
        teamspaceId: nextTeamspaceId,
      });
    }

    const criteria = {
      ...parsed.criteria,
      scope: nextScope,
      teamspaceId: nextScope === 'teamspace' ? nextTeamspaceId : null,
      defaultView: parsed.isDefault === true,
    };

    const [view] = await db
      .insert(savedFilters)
      .values({
        userId: session.user.id,
        organizationId: project.organizationId,
        projectId: project.id,
        name: parsed.name,
        description: parsed.description || null,
        query: parsed.query || `project = ${project.key}`,
        criteria: criteria as any,
        viewType: parsed.viewType,
        isPublic: nextScope === 'personal' ? false : (parsed.isPublic ?? true),
        isStarred: parsed.isPinned ?? parsed.isStarred ?? false,
        sortBy: 'updated_at',
        sortOrder: 'desc',
        usageCount: '0',
      })
      .returning();

    if (!view) {
      throw new Error('Failed to create view');
    }

    return NextResponse.json({ view: serializeProjectView(view, session.user.id) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid view payload', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create project view error:', error);
    return NextResponse.json({ error: 'Failed to create view' }, { status: 500 });
  }
}
