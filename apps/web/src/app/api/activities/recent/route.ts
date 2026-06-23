import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, auditLogs, users, issues, workflowStatuses } from '@tasknebula/db';
import { eq, desc, inArray } from 'drizzle-orm';
import { hasPermission } from '@/lib/auth/permissions';

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

    const canView = await hasPermission(organizationId, 'org:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
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
    const issueIds = logs.filter((log) => log.issueId).map((log) => log.issueId as string);

    let issuesMap: Record<string, { id: string; key: string; title: string }> = {};
    if (issueIds.length > 0) {
      const issuesData = await db
        .select({
          id: issues.id,
          key: issues.key,
          title: issues.title,
        })
        .from(issues)
        .where(inArray(issues.id, issueIds));

      issuesMap = issuesData.reduce(
        (acc, issue) => {
          acc[issue.id] = issue;
          return acc;
        },
        {} as Record<string, { id: string; key: string; title: string }>
      );
    }

    const statusIds = Array.from(
      new Set(logs.map((log) => getStatusTargetId(log.changes)).filter(isNonEmptyString))
    );

    const statusNameMap = new Map<string, string>();
    if (statusIds.length > 0) {
      const statuses = await db
        .select({
          id: workflowStatuses.id,
          name: workflowStatuses.name,
        })
        .from(workflowStatuses)
        .where(inArray(workflowStatuses.id, statusIds));

      statuses.forEach((status) => {
        statusNameMap.set(status.id, status.name);
      });
    }

    // Map logs to activity format. The client localizes messageKey/messageValues
    // with the active next-intl locale instead of rendering English API copy.
    const activities = logs.map((log) => {
      const statusTargetId = getStatusTargetId(log.changes);
      const message = getActivityMessageDescriptor(log.action, log.changes, {
        toStatusName: statusTargetId ? statusNameMap.get(statusTargetId) : undefined,
      });

      return {
        id: log.id,
        action: log.action,
        type: getActivityType(log.action),
        messageKey: message.key,
        messageValues: message.values,
        user: log.user,
        issue: log.issueId ? issuesMap[log.issueId] : null,
        createdAt: log.createdAt,
        metadata: log.metadata,
      };
    });

    return NextResponse.json({ activities });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

type RecordLike = Record<string, unknown>;

function isRecord(value: unknown): value is RecordLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getStatusTargetId(changes: unknown): string | null {
  if (!isRecord(changes) || !isRecord(changes.status)) return null;
  return isNonEmptyString(changes.status.to) ? changes.status.to : null;
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

function getChangeTarget(changes: unknown, key: string): string | null {
  if (!isRecord(changes) || !isRecord(changes[key])) return null;
  const target = changes[key].to;
  return isNonEmptyString(target) ? target : null;
}

type ActivityMessageDescriptor = {
  key:
    | 'createdIssue'
    | 'updatedIssue'
    | 'movedTo'
    | 'changedStatus'
    | 'assignedIssue'
    | 'unassignedIssue'
    | 'changedPriorityTo'
    | 'changedPriority'
    | 'commentedOn'
    | 'linkedIssue'
    | 'startedSprint'
    | 'completedSprint'
    | 'createdProject'
    | 'addedMemberToProject'
    | 'unknownAction';
  values?: Record<string, string>;
};

function getActivityMessageDescriptor(
  action: string,
  changes: unknown,
  labels: { toStatusName?: string } = {}
): ActivityMessageDescriptor {
  switch (action) {
    case 'issue.created':
      return { key: 'createdIssue' };
    case 'issue.updated':
      return { key: 'updatedIssue' };
    case 'issue.status_changed':
      if (labels.toStatusName) {
        return { key: 'movedTo', values: { status: labels.toStatusName } };
      }
      return { key: 'changedStatus' };
    case 'issue.assigned':
      return { key: 'assignedIssue' };
    case 'issue.unassigned':
      return { key: 'unassignedIssue' };
    case 'issue.priority_changed':
      {
        const priorityTarget = getChangeTarget(changes, 'priority');
        if (priorityTarget)
          return { key: 'changedPriorityTo', values: { priority: priorityTarget } };
      }
      return { key: 'changedPriority' };
    case 'issue.commented':
      return { key: 'commentedOn' };
    case 'issue.linked':
      return { key: 'linkedIssue' };
    case 'sprint.started':
      return { key: 'startedSprint' };
    case 'sprint.completed':
      return { key: 'completedSprint' };
    case 'project.created':
      return { key: 'createdProject' };
    case 'project.member_added':
      return { key: 'addedMemberToProject' };
    default:
      return { key: 'unknownAction', values: { action } };
  }
}
