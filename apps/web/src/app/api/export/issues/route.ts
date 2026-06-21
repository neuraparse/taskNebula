import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  issues,
  users,
  workflowStatuses,
  projects,
  organizationMembers,
  projectMembers,
} from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';

// GET /api/export/issues?projectId=xxx&format=csv|json
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const format = searchParams.get('format') || 'csv';

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
    // Permission check: caller must be member of the project's org (or super admin / project member)
    const [project] = await db
      .select({ id: projects.id, organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [currentUser] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser?.isSuperAdmin) {
      const [orgMember] = await db
        .select({ role: organizationMembers.role })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.userId, session.user.id),
            eq(organizationMembers.organizationId, project.organizationId),
            eq(organizationMembers.status, 'active')
          )
        )
        .limit(1);

      if (!orgMember) {
        const [projectMember] = await db
          .select({ userId: projectMembers.userId })
          .from(projectMembers)
          .where(
            and(eq(projectMembers.userId, session.user.id), eq(projectMembers.projectId, projectId))
          )
          .limit(1);

        if (!projectMember) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }
    // Fetch issues with related data
    const issuesList = await db
      .select({
        key: issues.key,
        title: issues.title,
        type: issues.type,
        status: workflowStatuses.name,
        priority: issues.priority,
        assignee: users.name,
        reporter: users.email,
        labels: issues.labels,
        estimate: issues.estimate,
        dueDate: issues.dueDate,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
      })
      .from(issues)
      .leftJoin(users, eq(issues.assigneeId, users.id))
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .where(eq(issues.projectId, projectId));

    if (format === 'json') {
      return NextResponse.json(issuesList, {
        headers: {
          'Content-Disposition': `attachment; filename="issues-${projectId}.json"`,
          'Content-Type': 'application/json',
        },
      });
    }

    // CSV format
    const headers = [
      'Key',
      'Title',
      'Type',
      'Status',
      'Priority',
      'Assignee',
      'Reporter',
      'Labels',
      'Estimate',
      'Due Date',
      'Created At',
      'Updated At',
    ];

    const csvRows = [
      headers.join(','),
      ...issuesList.map((issue) =>
        [
          issue.key,
          `"${issue.title?.replace(/"/g, '""') || ''}"`,
          issue.type,
          issue.status || '',
          issue.priority,
          `"${issue.assignee || 'Unassigned'}"`,
          issue.reporter || '',
          `"${Array.isArray(issue.labels) ? issue.labels.join('; ') : ''}"`,
          issue.estimate || '',
          issue.dueDate ? new Date(issue.dueDate).toISOString().split('T')[0] : '',
          new Date(issue.createdAt).toISOString(),
          new Date(issue.updatedAt).toISOString(),
        ].join(',')
      ),
    ];

    const csv = csvRows.join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Disposition': `attachment; filename="issues-${projectId}.csv"`,
        'Content-Type': 'text/csv',
      },
    });
  } catch (error) {
    console.error('Error exporting issues:', error);
    return NextResponse.json({ error: 'Failed to export issues' }, { status: 500 });
  }
}
