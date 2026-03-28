import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, workflowStatuses } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { publishEvent } from '@/lib/realtime/events';

// GET /api/sprints/[sprintId]/issues
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;

  try {
    const sprintIssues = await db
      .select({
        id: issues.id,
        organizationId: issues.organizationId,
        projectId: issues.projectId,
        key: issues.key,
        number: issues.number,
        type: issues.type,
        title: issues.title,
        description: issues.description,
        statusId: issues.statusId,
        priority: issues.priority,
        assigneeId: issues.assigneeId,
        reporterId: issues.reporterId,
        labels: issues.labels,
        sprintId: issues.sprintId,
        epicId: issues.epicId,
        parentId: issues.parentId,
        estimate: issues.estimate,
        dueDate: issues.dueDate,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        status: workflowStatuses.category,
        statusName: workflowStatuses.name,
        statusColor: workflowStatuses.color,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.sprintId, sprintId));

    return NextResponse.json(sprintIssues);
  } catch (error) {
    console.error('Error fetching sprint issues:', error);
    return NextResponse.json({ error: 'Failed to fetch sprint issues' }, { status: 500 });
  }
}

// POST /api/sprints/[sprintId]/issues
// Assign issue to sprint
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;

  try {
    const body = await request.json();
    const { issueId } = body;

    if (!issueId) {
      return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });
    }

    const [updatedIssue] = await db
      .update(issues)
      .set({
        sprintId,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(eq(issues.id, issueId))
      .returning();

    if (!updatedIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    publishEvent('sprint.issues.changed', session.user.id, { sprintId });

    return NextResponse.json(updatedIssue);
  } catch (error) {
    console.error('Error assigning issue to sprint:', error);
    return NextResponse.json({ error: 'Failed to assign issue to sprint' }, { status: 500 });
  }
}

// DELETE /api/sprints/[sprintId]/issues/[issueId]
// Remove issue from sprint
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sprintId } = await params;
  const { searchParams } = new URL(request.url);
  const issueId = searchParams.get('issueId');

  if (!issueId) {
    return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });
  }

  try {
    const [updatedIssue] = await db
      .update(issues)
      .set({
        sprintId: null,
        updatedAt: new Date(),
        updatedBy: session.user.id,
      })
      .where(and(eq(issues.id, issueId), eq(issues.sprintId, sprintId)))
      .returning();

    if (!updatedIssue) {
      return NextResponse.json({ error: 'Issue not found in sprint' }, { status: 404 });
    }

    publishEvent('sprint.issues.changed', session.user.id, { sprintId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing issue from sprint:', error);
    return NextResponse.json({ error: 'Failed to remove issue from sprint' }, { status: 500 });
  }
}

