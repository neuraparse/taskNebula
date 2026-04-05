import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, workflowStatuses, projects } from '@tasknebula/db';
import { eq, desc, inArray, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organizationId');
    const teamId = searchParams.get('teamId');

    let allowedProjectIds: string[] | null = null;
    if (organizationId || teamId) {
      const scopedProjects = await db
        .select({
          id: projects.id,
          key: projects.key,
          name: projects.name,
          teamId: projects.teamId,
        })
        .from(projects)
        .where(
          and(
            ...(organizationId ? [eq(projects.organizationId, organizationId)] : []),
            ...(teamId ? [eq(projects.teamId, teamId)] : [])
          )
        );

      allowedProjectIds = scopedProjects.map((project) => project.id);

      if (allowedProjectIds.length === 0) {
        return NextResponse.json({ issues: [] });
      }
    }

    // Fetch all issues assigned to the user
    const myIssuesRaw = await db
      .select()
      .from(issues)
      .where(
        and(
          eq(issues.assigneeId, session.user.id),
          ...(allowedProjectIds ? [inArray(issues.projectId, allowedProjectIds)] : [])
        )
      )
      .orderBy(desc(issues.updatedAt));

    if (myIssuesRaw.length === 0) {
      return NextResponse.json({ issues: [] });
    }

    // Get statuses
    const statusIds = [...new Set(myIssuesRaw.map((i) => i.statusId))];
    const statuses = await db
      .select()
      .from(workflowStatuses)
      .where(inArray(workflowStatuses.id, statusIds));

    // Get projects
    const projectIds = [...new Set(myIssuesRaw.map((i) => i.projectId))];
    const projectsData = await db
      .select()
      .from(projects)
      .where(inArray(projects.id, projectIds));

    // Map issues with their related data
    const myIssues = myIssuesRaw.map((issue) => ({
      ...issue,
      status: statuses.find((s) => s.id === issue.statusId) || { 
        name: 'Unknown', 
        category: 'backlog',
        color: '#64748b'
      },
      project: projectsData.find((p) => p.id === issue.projectId) || { 
        key: 'UNKNOWN', 
        name: 'Unknown' 
      },
    }));

    return NextResponse.json({ issues: myIssues });
  } catch (error) {
    console.error('Error fetching my issues:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}
