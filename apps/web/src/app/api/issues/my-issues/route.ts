import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, workflowStatuses, projects } from '@tasknebula/db';
import { eq, desc, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all issues assigned to the user
    const myIssuesRaw = await db
      .select()
      .from(issues)
      .where(eq(issues.assigneeId, session.user.id))
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

