import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, projects, sprints, issues } from '@tasknebula/db';
import { eq, and, count } from 'drizzle-orm';
import { publishEvent } from '@/lib/realtime/events';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { notifyProjectArchived } from '@/lib/notifications/project-events';
import { runAutomations } from '@/lib/automation/evaluator';
import { canManageProject, canReadProject } from '@/lib/auth/access-control';

// GET /api/projects/[projectId] - Get single project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const project = await resolveProjectByIdOrKey(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!(await canReadProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get sprint count
    const [sprintCount] = await db
      .select({ count: count() })
      .from(sprints)
      .where(eq(sprints.projectId, project.id));

    // Get issue count
    const [issueCount] = await db
      .select({ count: count() })
      .from(issues)
      .where(eq(issues.projectId, project.id));

    // Get active sprint
    const [activeSprint] = await db
      .select()
      .from(sprints)
      .where(and(eq(sprints.projectId, project.id), eq(sprints.status, 'active')))
      .limit(1);

    return NextResponse.json({
      ...project,
      sprintCount: sprintCount?.count || 0,
      issueCount: issueCount?.count || 0,
      activeSprint: activeSprint || null,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

// PATCH /api/projects/[projectId] - Update project
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
    const {
      name,
      key,
      description,
      status,
      visibility,
      settings,
      metadata,
      leadId,
      defaultWorkflowId,
    } = body;

    const project = await resolveProjectByIdOrKey(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!(await canManageProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {
      updatedBy: session.user.id,
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (key !== undefined) {
      const normalizedKey = String(key).trim().toUpperCase();

      if (!normalizedKey) {
        return NextResponse.json({ error: 'Project key cannot be empty' }, { status: 400 });
      }

      if (normalizedKey !== project.key) {
        const [existingProject] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(
            and(
              eq(projects.organizationId, project.organizationId),
              eq(projects.key, normalizedKey)
            )
          )
          .limit(1);

        if (existingProject) {
          return NextResponse.json(
            { error: 'Project key already exists in this organization' },
            { status: 409 }
          );
        }
      }

      updateData.key = normalizedKey;
    }
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (settings !== undefined) updateData.settings = settings;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (leadId !== undefined) updateData.leadId = leadId || null;
    if (defaultWorkflowId !== undefined) updateData.defaultWorkflowId = defaultWorkflowId || null;

    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, project.id))
      .returning();

    if (!updatedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    publishEvent('project.updated', session.user.id, {
      projectId: project.id,
      organizationId: project.organizationId,
    });

    // Fire-and-forget project.archived notifications to project members when
    // status transitions into 'archived'. Guarded so SMTP/DB faults never
    // fail the PATCH.
    if (status === 'archived' && project.status !== 'archived') {
      try {
        notifyProjectArchived({
          project: {
            id: updatedProject.id,
            name: updatedProject.name,
            key: updatedProject.key,
            description: updatedProject.description,
            organizationId: updatedProject.organizationId,
          },
          actorUserId: session.user.id,
        });
      } catch (err) {
        console.error('notifyProjectArchived dispatch failed:', err);
      }

      void runAutomations({
        trigger: 'project.archived',
        organizationId: project.organizationId,
        projectId: project.id,
        payload: { project: updatedProject },
        actorUserId: session.user.id,
      }).catch((err) => console.error('Failed to run project.archived automations:', err));
    }

    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId] - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;

  try {
    const project = await resolveProjectByIdOrKey(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!(await canManageProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if project has issues
    const [issueCount] = await db
      .select({ count: count() })
      .from(issues)
      .where(eq(issues.projectId, project.id));

    if (issueCount && issueCount.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete project with issues. Archive it instead.' },
        { status: 400 }
      );
    }

    const [deletedProject] = await db
      .delete(projects)
      .where(eq(projects.id, project.id))
      .returning();

    if (!deletedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    publishEvent('project.deleted', session.user.id, {
      projectId: project.id,
      organizationId: project.organizationId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
