import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, auditLogs, users, issues } from '@tasknebula/db';
import { eq, desc, and, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/activities/recent?organizationId=xxx&limit=20
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Fetch recent audit logs with user information
    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        projectId: auditLogs.projectId,
        issueId: auditLogs.issueId,
        changes: auditLogs.changes,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(auditLogs)
      .innerJoin(users, eq(auditLogs.userId, users.id))
      .where(eq(auditLogs.organizationId, organizationId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    // Get issue details for activities that have issueId
    const issueIds = logs
      .filter((log) => log.issueId)
      .map((log) => log.issueId as string);

    let issuesMap: Record<string, any> = {};
    if (issueIds.length > 0) {
      const issuesData = await db
        .select({
          id: issues.id,
          key: issues.key,
          title: issues.title,
        })
        .from(issues)
        .where(inArray(issues.id, issueIds));

      issuesMap = issuesData.reduce((acc, issue) => {
        acc[issue.id] = issue;
        return acc;
      }, {} as Record<string, any>);
    }

    // Map logs to activity format
    const activities = logs.map((log) => ({
      id: log.id,
      action: log.action,
      type: getActivityType(log.action),
      message: getActivityMessage(log.action, log.changes),
      user: log.user,
      issue: log.issueId ? issuesMap[log.issueId] : null,
      createdAt: log.createdAt,
      metadata: log.metadata,
    }));

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

function getActivityType(action: string): string {
  if (action.includes('commented')) return 'comment';
  if (action.includes('status_changed')) return 'status_change';
  if (action.includes('assigned')) return 'assigned';
  if (action.includes('linked')) return 'linked';
  if (action.includes('sprint.started')) return 'sprint_started';
  if (action.includes('sprint.completed')) return 'sprint_completed';
  if (action.includes('created')) return 'created';
  if (action.includes('updated')) return 'updated';
  return 'other';
}

function getActivityMessage(action: string, changes: any): string {
  switch (action) {
    case 'issue.created':
      return 'created issue';
    case 'issue.updated':
      return 'updated issue';
    case 'issue.status_changed':
      if (changes?.status) {
        return `moved to ${changes.status.to}`;
      }
      return 'changed status';
    case 'issue.assigned':
      return 'assigned issue';
    case 'issue.unassigned':
      return 'unassigned issue';
    case 'issue.priority_changed':
      if (changes?.priority) {
        return `changed priority to ${changes.priority.to}`;
      }
      return 'changed priority';
    case 'issue.commented':
      return 'commented on';
    case 'issue.linked':
      return 'linked issue';
    case 'sprint.started':
      return 'started sprint';
    case 'sprint.completed':
      return 'completed sprint';
    case 'project.created':
      return 'created project';
    case 'project.member_added':
      return 'added member to project';
    default:
      return action.replace(/\./g, ' ').replace(/_/g, ' ');
  }
}

