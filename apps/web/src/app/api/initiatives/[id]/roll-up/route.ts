import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  initiatives,
  initiativeProjects,
  organizationMembers,
  projects,
  issues,
  workflowStatuses,
} from '@tasknebula/db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  collectInitiativeAndDescendants,
  rollUpProgress,
  type ProjectIssueCounts,
} from '@/lib/initiatives/rollup';

/**
 * GET /api/initiatives/[id]/roll-up
 *
 * Walks the subtree rooted at `id`, finds every linked project across the
 * tree, and reports done / total / percent over the issue set.
 *
 * "Done" is determined by workflow status category — we count an issue as
 * done when its `workflow_statuses.category` is `'done'`. This matches what
 * the project board UI already considers complete.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [root] = await db
    .select()
    .from(initiatives)
    .where(eq(initiatives.id, id))
    .limit(1);
  if (!root) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, session.user.id),
        eq(organizationMembers.organizationId, root.workspaceId)
      )
    )
    .limit(1);
  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Pull every initiative in this workspace so we can compute the subtree.
  const allInWorkspace = await db
    .select({
      id: initiatives.id,
      parentInitiativeId: initiatives.parentInitiativeId,
    })
    .from(initiatives)
    .where(eq(initiatives.workspaceId, root.workspaceId));

  const childrenByParent = new Map<string | null, string[]>();
  for (const node of allInWorkspace) {
    const key = node.parentInitiativeId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(node.id);
  }

  const initiativeIds = collectInitiativeAndDescendants(id, childrenByParent);

  // Find every project linked to any initiative in the subtree (de-dupe).
  const linkRows = await db
    .select({ projectId: initiativeProjects.projectId })
    .from(initiativeProjects)
    .where(inArray(initiativeProjects.initiativeId, initiativeIds));
  const projectIdSet = new Set(linkRows.map((r) => r.projectId));
  const projectIds = Array.from(projectIdSet);

  if (projectIds.length === 0) {
    return NextResponse.json({
      initiativeId: id,
      subtreeSize: initiativeIds.length,
      ...rollUpProgress({ projects: [] }),
      perProject: [],
    });
  }

  // Aggregate issue counts per project: total issues + issues in `done`
  // status category.
  const counts = await db
    .select({
      projectId: issues.projectId,
      projectName: projects.name,
      projectKey: projects.key,
      total: sql<number>`count(${issues.id})::int`,
      done: sql<number>`count(*) filter (where ${workflowStatuses.category} = 'done')::int`,
    })
    .from(issues)
    .leftJoin(workflowStatuses, eq(workflowStatuses.id, issues.statusId))
    .leftJoin(projects, eq(projects.id, issues.projectId))
    .where(inArray(issues.projectId, projectIds))
    .groupBy(issues.projectId, projects.name, projects.key);

  const buckets: ProjectIssueCounts[] = counts.map((row) => ({
    projectId: row.projectId,
    done: Number(row.done) || 0,
    total: Number(row.total) || 0,
  }));

  // Backfill projects that have no issues at all (so the UI can still list them).
  for (const projectId of projectIds) {
    if (!buckets.some((b) => b.projectId === projectId)) {
      buckets.push({ projectId, done: 0, total: 0 });
    }
  }

  const summary = rollUpProgress({ projects: buckets });

  return NextResponse.json({
    initiativeId: id,
    subtreeSize: initiativeIds.length,
    ...summary,
    perProject: counts.map((row) => ({
      projectId: row.projectId,
      projectName: row.projectName,
      projectKey: row.projectKey,
      done: Number(row.done) || 0,
      total: Number(row.total) || 0,
      percent:
        Number(row.total) > 0
          ? Math.round((Number(row.done) / Number(row.total)) * 100)
          : 0,
    })),
  });
}
