import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issues, projects, workflowStatuses } from '@tasknebula/db';
import { and, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { canReadProject } from '@/lib/auth/access-control';

const windows = new Set(['today', 'this_week', 'this_sprint', 'overdue']);

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function endOfThisWeek() {
  const date = endOfToday();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() + (7 - day));
  return date;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const window = request.nextUrl.searchParams.get('window') || 'this_week';
  if (!windows.has(window)) {
    return NextResponse.json({ error: 'Invalid window' }, { status: 400 });
  }

  const now = new Date();
  const dueCutoff =
    window === 'today'
      ? endOfToday()
      : window === 'this_week' || window === 'this_sprint'
        ? endOfThisWeek()
        : now;

  const scopedIssues = await db
    .select()
    .from(issues)
    .where(
      and(
        eq(issues.assigneeId, session.user.id),
        ...(window === 'overdue'
          ? [isNotNull(issues.dueDate), lte(issues.dueDate, now)]
          : [isNotNull(issues.dueDate), lte(issues.dueDate, dueCutoff)])
      )
    );

  const statusIds = [...new Set(scopedIssues.map((issue) => issue.statusId))];
  const projectIds = [...new Set(scopedIssues.map((issue) => issue.projectId))];
  const [statuses, projectRows] = await Promise.all([
    statusIds.length > 0
      ? db.select().from(workflowStatuses).where(inArray(workflowStatuses.id, statusIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db.select().from(projects).where(inArray(projects.id, projectIds))
      : Promise.resolve([]),
  ]);

  const statusById = new Map(statuses.map((status) => [status.id, status]));
  const projectById = new Map(projectRows.map((project) => [project.id, project]));
  const readableProjectIds = new Set<string>();
  for (const project of projectRows) {
    if (await canReadProject(session.user.id, project)) {
      readableProjectIds.add(project.id);
    }
  }

  const countsByStatus: Record<string, number> = {};
  const countsByPriority: Record<string, number> = {};
  let overdue = 0;
  let dueSoon = 0;

  const readableIssues = scopedIssues.filter((issue) => readableProjectIds.has(issue.projectId));

  const items = readableIssues.map((issue) => {
    const status = statusById.get(issue.statusId);
    const project = projectById.get(issue.projectId);
    const statusName = status?.name ?? 'Unknown';
    countsByStatus[statusName] = (countsByStatus[statusName] ?? 0) + 1;
    countsByPriority[issue.priority] = (countsByPriority[issue.priority] ?? 0) + 1;
    if (issue.dueDate && issue.dueDate < now) overdue += 1;
    if (issue.dueDate && issue.dueDate >= now && issue.dueDate <= endOfThisWeek()) dueSoon += 1;

    return {
      id: issue.id,
      key: issue.key,
      title: issue.title,
      priority: issue.priority,
      dueDate: issue.dueDate,
      status: status
        ? { id: status.id, name: status.name, category: status.category, color: status.color }
        : null,
      project: project ? { id: project.id, key: project.key, name: project.name } : null,
    };
  });

  return NextResponse.json({
    window,
    total: readableIssues.length,
    countsByStatus,
    countsByPriority,
    overdue,
    dueSoon,
    issues: items,
  });
}
