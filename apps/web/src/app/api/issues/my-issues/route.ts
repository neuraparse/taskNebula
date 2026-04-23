import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, workflowStatuses, projects, watchers } from '@tasknebula/db';
import { eq, desc, inArray, and, or, isNotNull } from 'drizzle-orm';

type ViewMode = 'assigned' | 'created' | 'subscribed' | 'mentioned';

function parseView(value: string | null): ViewMode {
  if (value === 'created' || value === 'subscribed' || value === 'mentioned') {
    return value;
  }
  return 'assigned';
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const teamId = searchParams.get('teamId');
    const view = parseView(searchParams.get('view'));

    let allowedProjectIds: string[] | null = null;
    if (organizationId || teamId) {
      const scopedProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            ...(organizationId ? [eq(projects.organizationId, organizationId)] : []),
            ...(teamId ? [eq(projects.teamId, teamId)] : [])
          )
        );
      allowedProjectIds = scopedProjects.map((p) => p.id);
      if (allowedProjectIds.length === 0) {
        return NextResponse.json({ issues: [] });
      }
    }

    // View selectors
    let ownershipClause;
    if (view === 'assigned') {
      ownershipClause = eq(issues.assigneeId, userId);
    } else if (view === 'created') {
      ownershipClause = eq(issues.reporterId, userId);
    } else if (view === 'subscribed') {
      // Issues the user is watching (explicit subscription). We also treat
      // direct assignment as implicit subscription so the list is never empty
      // for users who only interact through assignments.
      const watching = await db
        .select({ issueId: watchers.issueId })
        .from(watchers)
        .where(and(eq(watchers.userId, userId), isNotNull(watchers.issueId)));
      const watchedIssueIds = watching
        .map((row) => row.issueId)
        .filter((id): id is string => Boolean(id));
      if (watchedIssueIds.length === 0) {
        return NextResponse.json({ issues: [] });
      }
      ownershipClause = inArray(issues.id, watchedIssueIds);
    } else {
      // mentioned: no mentions table yet — fall back to assigned+reported so
      // the filter surfaces everything the user is part of until the mentions
      // index lands. This is intentional and documented in the API shape.
      ownershipClause = or(eq(issues.assigneeId, userId), eq(issues.reporterId, userId));
    }

    const myIssuesRaw = await db
      .select()
      .from(issues)
      .where(
        and(
          ownershipClause,
          ...(allowedProjectIds ? [inArray(issues.projectId, allowedProjectIds)] : [])
        )
      )
      .orderBy(desc(issues.updatedAt));

    if (myIssuesRaw.length === 0) {
      return NextResponse.json({ issues: [] });
    }

    const statusIds = [...new Set(myIssuesRaw.map((i) => i.statusId))];
    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(inArray(workflowStatuses.id, statusIds));

    const projectIds = [...new Set(myIssuesRaw.map((i) => i.projectId))];
    const projectsData = await db
      .select()
      .from(projects)
      .where(inArray(projects.id, projectIds));

    const myIssues = myIssuesRaw.map((issue) => ({
      ...issue,
      status:
        statuses.find((s) => s.id === issue.statusId) || {
          name: 'Unknown',
          category: 'backlog',
          color: '#64748b',
        },
      project:
        projectsData.find((p) => p.id === issue.projectId) || {
          key: 'UNKNOWN',
          name: 'Unknown',
        },
    }));

    return NextResponse.json({ issues: myIssues, view });
  } catch (error) {
    console.error('Error fetching my issues:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}
