import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  issues,
  issueStatusHistory,
  projects,
  projectMembers,
  organizationMembers,
  users,
  createAuditLog,
} from '@tasknebula/db';
import { eq, inArray, and } from 'drizzle-orm';
import { z } from 'zod';
import { publishEvent } from '@/lib/realtime/events';
import { syncIssueLabelsBestEffort } from '@/lib/labels/sync';

export const dynamic = 'force-dynamic';

const bulkUpdateSchema = z.object({
  issueIds: z.array(z.string()).min(1),
  updates: z.object({
    statusId: z.string().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
    assigneeId: z.string().optional(),
    labels: z.array(z.string()).optional(),
    sprintId: z.string().optional(),
  }),
});

const bulkDeleteSchema = z.object({
  issueIds: z.array(z.string()).min(1),
});

type BulkAction = 'edit' | 'delete';

/**
 * Verify the caller has the given permission on every distinct project the
 * provided issues belong to. Rejects the ENTIRE request if any id is
 * unauthorized or unknown.
 */
async function assertBulkPermission(
  userId: string,
  issueIds: string[],
  action: BulkAction
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const rows = await db
    .select({ id: issues.id, projectId: issues.projectId })
    .from(issues)
    .where(inArray(issues.id, issueIds));

  if (rows.length !== issueIds.length) {
    return { ok: false, status: 404, error: 'Some issues not found' };
  }

  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.isSuperAdmin) {
    return { ok: true };
  }

  const projectIds = Array.from(new Set(rows.map((r) => r.projectId)));

  for (const projectId of projectIds) {
    const [project] = await db
      .select({ id: projects.id, organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return { ok: false, status: 404, error: 'Project not found' };
    }

    const [orgMember] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, project.organizationId)
        )
      )
      .limit(1);

    if (orgMember?.role === 'owner') {
      continue;
    }

    const [projectMember] = await db
      .select({
        role: projectMembers.role,
        canEditIssues: projectMembers.canEditIssues,
        canDeleteIssues: projectMembers.canDeleteIssues,
      })
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
      .limit(1);

    if (!projectMember) {
      return {
        ok: false,
        status: 403,
        error: 'Not a project member for one or more issues',
      };
    }

    const toBool = (val: string | null | undefined): boolean => val === 'true';
    const canModify =
      action === 'edit'
        ? toBool(projectMember.canEditIssues)
        : toBool(projectMember.canDeleteIssues);

    // Fall back to role defaults for common roles
    const elevatedRoles = ['product_owner', 'tech_lead', 'scrum_master'];
    const allowedByRole =
      action === 'edit'
        ? [
            'product_owner',
            'scrum_master',
            'tech_lead',
            'developer',
            'qa_engineer',
            'designer',
          ].includes(projectMember.role)
        : elevatedRoles.includes(projectMember.role);

    if (!canModify && !allowedByRole) {
      return {
        ok: false,
        status: 403,
        error: `Insufficient permission to ${action} issues in one or more projects`,
      };
    }
  }

  return { ok: true };
}

/**
 * POST /api/issues/bulk
 *
 * Bulk update issues
 *
 * Body:
 * {
 *   "action": "update" | "delete",
 *   "issueIds": ["id1", "id2", ...],
 *   "updates": { "status": "done", "priority": "high", ... } // for update action
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action;

    if (!action || !['update', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "update" or "delete"' },
        { status: 400 }
      );
    }

    if (action === 'update') {
      return await handleBulkUpdate(body, session.user.id);
    } else if (action === 'delete') {
      return await handleBulkDelete(body, session.user.id);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Bulk operation error:', error);
    return NextResponse.json({ error: 'Failed to perform bulk operation' }, { status: 500 });
  }
}

/**
 * Handle bulk update
 */
async function handleBulkUpdate(body: any, userId: string) {
  const validatedData = bulkUpdateSchema.parse(body);
  const { issueIds, updates } = validatedData;

  const auth = await assertBulkPermission(userId, issueIds, 'edit');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Verify all issues exist and get their current state
  const existingIssues = await db.select().from(issues).where(inArray(issues.id, issueIds));

  if (existingIssues.length !== issueIds.length) {
    return NextResponse.json({ error: 'Some issues not found' }, { status: 404 });
  }

  // Perform bulk update
  const updateData: any = {
    ...updates,
    updatedAt: new Date(),
  };

  const updatedIssues = await db
    .update(issues)
    .set(updateData)
    .where(inArray(issues.id, issueIds))
    .returning();

  // FEAT-23: write issue_status_history rows for every status change in this
  // bulk update. Best-effort: if the insert fails (e.g. dropped status id)
  // we still want the bulk response to surface.
  if (updates.statusId) {
    const historyRows = existingIssues
      .filter((oldIssue) => oldIssue.statusId !== updates.statusId)
      .map((oldIssue) => ({
        issueId: oldIssue.id,
        fromStatus: oldIssue.statusId,
        toStatus: updates.statusId!,
        changedByUserId: userId,
        reason: 'user_bulk',
      }));
    if (historyRows.length > 0) {
      try {
        await db.insert(issueStatusHistory).values(historyRows);
      } catch (err) {
        console.error('bulk issue_status_history insert failed', err);
      }
    }
  }

  // Write-through to the first-class labels layer. The jsonb write above
  // (`issues.labels`) stays the REST contract; this mirrors the names into
  // labels/issue_labels per issue and never fails the bulk update.
  if (updates.labels !== undefined) {
    for (const issue of updatedIssues) {
      await syncIssueLabelsBestEffort({
        organizationId: issue.organizationId,
        issueId: issue.id,
        labels: updates.labels,
        createdBy: userId,
      });
    }
  }

  // Create audit logs for each updated issue
  // sprintId -> organizationId, so sprint.issues.changed events carry the org
  // (the SSE stream drops org-less events). An issue's old/new sprint always
  // belongs to the same org as the issue.
  const affectedSprintIds = new Map<string, string>();
  for (const issue of updatedIssues) {
    const oldIssue = existingIssues.find((i) => i.id === issue.id);
    if (oldIssue) {
      try {
        // Build changes object
        const changes: Record<string, { from: any; to: any }> = {};
        for (const key of Object.keys(updates)) {
          const oldValue = (oldIssue as any)[key];
          const newValue = (issue as any)[key];
          if (oldValue !== newValue) {
            changes[key] = {
              from: oldValue,
              to: newValue,
            };
          }
        }

        await createAuditLog({
          action: 'issue.updated',
          userId,
          organizationId: issue.organizationId,
          resourceType: 'issue',
          resourceId: issue.id,
          changes,
          metadata: { bulkOperation: true },
        });
      } catch (error) {
        console.error('Failed to create audit log:', error);
      }
    }

    publishEvent('issue.updated', userId, {
      issueId: issue.id,
      projectId: issue.projectId,
      organizationId: issue.organizationId,
      sprintId: issue.sprintId ?? undefined,
    });
    if (issue.sprintId) affectedSprintIds.set(issue.sprintId, issue.organizationId);
    const oldSprint = existingIssues.find((i) => i.id === issue.id)?.sprintId;
    if (oldSprint && oldSprint !== issue.sprintId)
      affectedSprintIds.set(oldSprint, issue.organizationId);
  }

  for (const [sprintId, organizationId] of affectedSprintIds) {
    publishEvent('sprint.issues.changed', userId, { sprintId, organizationId });
  }

  return NextResponse.json({
    success: true,
    updatedCount: updatedIssues.length,
    issues: updatedIssues,
  });
}

/**
 * Handle bulk delete
 */
async function handleBulkDelete(body: any, userId: string) {
  const validatedData = bulkDeleteSchema.parse(body);
  const { issueIds } = validatedData;

  const auth = await assertBulkPermission(userId, issueIds, 'delete');
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Verify all issues exist
  const existingIssues = await db.select().from(issues).where(inArray(issues.id, issueIds));

  if (existingIssues.length !== issueIds.length) {
    return NextResponse.json({ error: 'Some issues not found' }, { status: 404 });
  }

  // Delete issues
  await db.delete(issues).where(inArray(issues.id, issueIds));

  // Create audit logs for each deleted issue
  // sprintId -> organizationId, so sprint.issues.changed events carry the org
  // (the SSE stream drops org-less events).
  const affectedSprintIds = new Map<string, string>();
  for (const issue of existingIssues) {
    try {
      await createAuditLog({
        action: 'issue.deleted',
        userId,
        organizationId: issue.organizationId,
        resourceType: 'issue',
        resourceId: issue.id,
        changes: {
          statusId: { from: issue.statusId, to: 'deleted' },
        },
        metadata: { bulkOperation: true },
      });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }

    publishEvent('issue.deleted', userId, {
      issueId: issue.id,
      projectId: issue.projectId,
      organizationId: issue.organizationId,
      sprintId: issue.sprintId ?? undefined,
    });
    if (issue.sprintId) affectedSprintIds.set(issue.sprintId, issue.organizationId);
  }

  for (const [sprintId, organizationId] of affectedSprintIds) {
    publishEvent('sprint.issues.changed', userId, { sprintId, organizationId });
  }

  return NextResponse.json({
    success: true,
    deletedCount: existingIssues.length,
  });
}
