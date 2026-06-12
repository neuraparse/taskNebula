import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  sprints,
  projects,
  projectMembers,
  organizationMembers,
  users,
  ROLE_DEFAULT_PERMISSIONS,
  type ProjectRole,
} from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { rolloverCycle } from '@/lib/issues/cycle-rollover';
import { publishEvent } from '@/lib/realtime/events';

/**
 * POST /api/cycles/[cycleId]/rollover
 *
 * Manual trigger that runs the same logic as the daily cron — moves every
 * non-Done issue from this cycle into the next cycle of its project and
 * appends `cycle_rollover` history rows.
 *
 * Naming note: cycles are stored in the `sprints` table; the `/cycles` URL
 * is the public-facing alias the roadmap uses (FEAT-23). New code should
 * prefer this route over `/api/sprints/[id]` for rollover operations.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ cycleId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { cycleId } = await params;

  const [cycle] = await db.select().from(sprints).where(eq(sprints.id, cycleId)).limit(1);

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
  }

  // Permission: manage_sprints on this project, with org-owner/super-admin
  // fast-paths matching the existing sprint endpoints.
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Resolved unconditionally so realtime events below can carry the
  // organizationId (the SSE stream drops org-less events).
  const [project] = await db
    .select({ organizationId: projects.organizationId })
    .from(projects)
    .where(eq(projects.id, cycle.projectId))
    .limit(1);

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!user?.isSuperAdmin) {
    const [orgMember] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, project.organizationId)
        )
      )
      .limit(1);

    if (orgMember?.role !== 'owner') {
      const [projectMember] = await db
        .select()
        .from(projectMembers)
        .where(
          and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, cycle.projectId))
        )
        .limit(1);

      if (!projectMember) {
        return NextResponse.json({ error: 'Not a project member' }, { status: 403 });
      }

      const roleDefaults =
        ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] ||
        ROLE_DEFAULT_PERMISSIONS.viewer;
      const allowed = projectMember.canManageSprints === 'true' || roleDefaults.canManageSprints;
      if (!allowed) {
        return NextResponse.json({ error: 'No permission to manage sprints' }, { status: 403 });
      }
    }
  }

  const result = await rolloverCycle(cycleId, userId, /* manualOverride */ true);

  publishEvent('sprint.updated', userId, {
    projectId: cycle.projectId,
    sprintId: cycleId,
    organizationId: project.organizationId,
  });
  if (result.nextCycleId) {
    publishEvent('sprint.updated', userId, {
      projectId: cycle.projectId,
      sprintId: result.nextCycleId,
      organizationId: project.organizationId,
    });
  }

  return NextResponse.json({
    cycleId,
    nextCycleId: result.nextCycleId,
    movedIssueIds: result.movedIssueIds,
    movedCount: result.movedIssueIds.length,
    reason: result.reason,
  });
}
