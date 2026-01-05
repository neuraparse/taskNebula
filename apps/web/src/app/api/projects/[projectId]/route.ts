import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, projects, sprints, issues } from '@tasknebula/db';
import { eq, count } from 'drizzle-orm';

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
    // Try to find by ID first, then by key
    let [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      // Try finding by key (case insensitive)
      [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.key, projectId.toUpperCase()))
        .limit(1);
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
      .where(eq(sprints.projectId, project.id))
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
    const { name, description, status, settings, metadata } = body;

    const updateData: Record<string, unknown> = {
      updatedBy: session.user.id,
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (settings !== undefined) updateData.settings = settings;
    if (metadata !== undefined) updateData.metadata = metadata;

    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning();

    if (!updatedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
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
    // Check if project has issues
    const [issueCount] = await db
      .select({ count: count() })
      .from(issues)
      .where(eq(issues.projectId, projectId));

    if (issueCount && issueCount.count > 0) {
      return NextResponse.json(
        { error: 'Cannot delete project with issues. Archive it instead.' },
        { status: 400 }
      );
    }

    const [deletedProject] = await db
      .delete(projects)
      .where(eq(projects.id, projectId))
      .returning();

    if (!deletedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

