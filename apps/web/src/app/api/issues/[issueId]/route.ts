import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import {
  getIssueById,
  updateIssue,
  deleteIssue,
  createActivity,
  createAuditLog,
  db,
  issues,
  workflowStatuses,
  workflows,
  projects,
  projectMembers,
  organizationMembers,
  users,
  ROLE_DEFAULT_PERMISSIONS,
  type ProjectRole,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and } from 'drizzle-orm';
import { publishEvent } from '@/lib/realtime/events';
import { notifyIssueEvent } from '@/lib/notifications/send-notification';
import { runAutomations } from '@/lib/automation/evaluator';
import { withValidation } from '@/lib/api-validation';

// Params schema for /api/issues/[issueId] — kept loose (`min(1)`) to allow
// the existing dataset of mixed-format ids; tighten to `id` from
// `@/lib/validation/common` once legacy ids are migrated.
const issueParamsSchema = z.object({ issueId: z.string().min(1) });

type IssueAction =
  | 'view'
  | 'edit'
  | 'delete'
  | 'assign'
  | 'transition'
  | 'schedule'
  | 'close'
  | 'reopen';

// Granular permission check helper for issues
async function checkIssuePermission(
  userId: string,
  projectId: string,
  action: IssueAction,
  issueReporterId?: string | null
): Promise<{ allowed: boolean; reason?: string }> {
  // Get user super admin status
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user?.isSuperAdmin) {
    return { allowed: true };
  }

  // Get project with organization
  const [project] = await db
    .select({
      id: projects.id,
      organizationId: projects.organizationId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    return { allowed: false, reason: 'Project not found' };
  }

  // Check organization membership
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

  // Org owners have full access
  if (orgMember?.role === 'owner') {
    return { allowed: true };
  }

  // Get project membership with all permission columns
  const [projectMember] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!projectMember) {
    if (orgMember?.role === 'admin' && action === 'view') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Not a project member' };
  }

  // Get role defaults
  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  const toBool = (val: string | null | undefined): boolean => val === 'true';
  const isOwnIssue = issueReporterId === userId;

  // Check specific permissions based on action
  switch (action) {
    case 'view':
      return { allowed: true };

    case 'edit':
      // Check if can edit all issues or own issues
      if (toBool(projectMember.canEditIssues) || roleDefaults.canEditIssues) {
        return { allowed: true };
      }
      if (isOwnIssue && (toBool(projectMember.canEditOwnIssues) || roleDefaults.canEditOwnIssues)) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to edit issues' };

    case 'delete':
      // Check if can delete all issues or own issues
      if (toBool(projectMember.canDeleteIssues) || roleDefaults.canDeleteIssues) {
        return { allowed: true };
      }
      if (
        isOwnIssue &&
        (toBool(projectMember.canDeleteOwnIssues) || roleDefaults.canDeleteOwnIssues)
      ) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to delete issues' };

    case 'assign':
      if (toBool(projectMember.canAssignIssues) || roleDefaults.canAssignIssues) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to assign issues' };

    case 'transition':
      if (toBool(projectMember.canTransitionIssues) || roleDefaults.canTransitionIssues) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to transition issues' };

    case 'schedule':
      if (toBool(projectMember.canScheduleIssues) || roleDefaults.canScheduleIssues) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to schedule issues' };

    case 'close':
      if (toBool(projectMember.canCloseIssues) || roleDefaults.canCloseIssues) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to close issues' };

    case 'reopen':
      if (toBool(projectMember.canReopenIssues) || roleDefaults.canReopenIssues) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'No permission to reopen issues' };

    default:
      return { allowed: false, reason: 'Unknown action' };
  }
}

// Validation schema for updating an issue
const updateIssueSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  // ProseMirror JSON snapshot from the collaborative editor
  // (P1-09 follow-up). Persisted into `issues.description_rich` so the
  // non-collab read path can rebuild lists / bold / links / code blocks.
  descriptionRich: z.record(z.any()).nullable().optional(),
  status: z.string().optional(), // Status category (backlog, in_progress, etc.)
  statusId: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).optional(),
  assigneeId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  sprintId: z.string().nullable().optional(),
  epicId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  estimate: z.number().nullable().optional(),
  // Time-tracking estimate (in hours) and its provenance — `manual` when the
  // user typed it, `ai_suggest` when the AI estimator wrote it. The
  // TimeTrackingPanel posts both fields together; without them in the
  // schema, Zod silently drops the keys and the panel's "Save estimate"
  // button becomes a no-op.
  estimateHours: z.number().nullable().optional(),
  estimateSource: z.enum(['manual', 'ai_suggest']).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  customFields: z.record(z.any()).optional(),
});

// GET /api/issues/[issueId] - Get a single issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;
    const issue = await getIssueById(issueId);

    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Permission check: ensure caller can view this issue
    const permission = await checkIssuePermission(
      session.user.id,
      issue.projectId,
      'view',
      issue.reporterId
    );
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    return NextResponse.json(issue);
  } catch (error) {
    console.error('Error fetching issue:', error);
    return NextResponse.json({ error: 'Failed to fetch issue' }, { status: 500 });
  }
}

// PATCH /api/issues/[issueId] - Update an issue
// Migrated to withValidation (FEAT-29). `params` and `body` are now parsed
// by the wrapper; failures short-circuit with a 400 envelope before this
// handler runs.
export const PATCH = withValidation({
  body: updateIssueSchema,
  params: issueParamsSchema,
})(async (request, { body: validatedData, params }) => {
  const { issueId } = params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current issue for comparison
    const currentIssue = await getIssueById(issueId);
    if (!currentIssue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Determine required permissions based on what's being changed
    const permissionChecks: IssueAction[] = [];

    // Basic edit permission for title, description, priority, labels, estimate, dueDate
    if (
      validatedData.title ||
      validatedData.description !== undefined ||
      validatedData.priority ||
      validatedData.labels ||
      validatedData.estimate !== undefined ||
      validatedData.dueDate !== undefined
    ) {
      permissionChecks.push('edit');
    }

    // Assign permission for assignee changes
    if (
      validatedData.assigneeId !== undefined &&
      validatedData.assigneeId !== currentIssue.assigneeId
    ) {
      permissionChecks.push('assign');
    }

    // Transition permission for status changes
    if (
      (validatedData.status || validatedData.statusId) &&
      validatedData.statusId !== currentIssue.statusId
    ) {
      permissionChecks.push('transition');
    }

    // Schedule permission for sprint changes
    if (validatedData.sprintId !== undefined && validatedData.sprintId !== currentIssue.sprintId) {
      permissionChecks.push('schedule');
    }

    // Check all required permissions
    for (const action of permissionChecks) {
      const permission = await checkIssuePermission(
        session.user.id!,
        currentIssue.projectId,
        action,
        currentIssue.reporterId
      );
      if (!permission.allowed) {
        return NextResponse.json(
          { error: permission.reason || 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // If status category is provided instead of statusId, convert it
    const updateData = { ...validatedData };
    if (validatedData.status && !validatedData.statusId) {
      // Get the workflow for this project's organization
      const workflowResults = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.organizationId, currentIssue.organizationId),
            eq(workflows.isDefault, true)
          )
        )
        .limit(1);

      const workflow = workflowResults[0];
      if (!workflow) {
        return NextResponse.json({ error: 'No workflow found' }, { status: 500 });
      }

      // Get the first status with the matching category
      const statusResults = await db
        .select()
        .from(workflowStatuses)
        .where(eq(workflowStatuses.workflowId, workflow.id));

      const matchingStatuses = statusResults
        .filter((s) => s.category === validatedData.status)
        .sort((a, b) => a.position - b.position);

      const firstMatching = matchingStatuses[0];
      if (!firstMatching) {
        return NextResponse.json({ error: 'Status not found' }, { status: 404 });
      }

      // Use the first matching status
      updateData.statusId = firstMatching.id;
      delete updateData.status;
    }

    const updatedIssueData = await updateIssue(issueId, updateData);

    if (!updatedIssueData) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Create activity logs for changed fields
    const activityPromises = [];

    if (updateData.statusId && updateData.statusId !== currentIssue.statusId) {
      activityPromises.push(
        createActivity({
          issueId,
          userId: session.user.id,
          type: 'status_changed',
          field: 'status',
          oldValue: currentIssue.statusId,
          newValue: updateData.statusId,
        })
      );
    }

    if (updateData.assigneeId !== undefined && updateData.assigneeId !== currentIssue.assigneeId) {
      activityPromises.push(
        createActivity({
          issueId,
          userId: session.user.id,
          type: 'assigned',
          field: 'assignee',
          oldValue: currentIssue.assigneeId || null,
          newValue: updateData.assigneeId || null,
        })
      );
    }

    if (updateData.priority && updateData.priority !== currentIssue.priority) {
      activityPromises.push(
        createActivity({
          issueId,
          userId: session.user.id,
          type: 'updated',
          field: 'priority',
          oldValue: currentIssue.priority,
          newValue: updateData.priority,
        })
      );
    }

    if (updateData.title && updateData.title !== currentIssue.title) {
      activityPromises.push(
        createActivity({
          issueId,
          userId: session.user.id,
          type: 'updated',
          field: 'title',
          oldValue: currentIssue.title,
          newValue: updateData.title,
        })
      );
    }

    if (
      updateData.description !== undefined &&
      updateData.description !== currentIssue.description
    ) {
      activityPromises.push(
        createActivity({
          issueId,
          userId: session.user.id,
          type: 'updated',
          field: 'description',
        })
      );
    }

    // Execute all activity logs
    await Promise.all(activityPromises);

    // Create audit log for issue update
    const changes: Record<string, { from: any; to: any }> = {};
    if (updateData.statusId && updateData.statusId !== currentIssue.statusId) {
      changes.status = { from: currentIssue.statusId, to: updateData.statusId };
    }
    if (updateData.assigneeId !== undefined && updateData.assigneeId !== currentIssue.assigneeId) {
      changes.assigneeId = { from: currentIssue.assigneeId, to: updateData.assigneeId };
    }
    if (updateData.priority && updateData.priority !== currentIssue.priority) {
      changes.priority = { from: currentIssue.priority, to: updateData.priority };
    }
    if (updateData.title && updateData.title !== currentIssue.title) {
      changes.title = { from: currentIssue.title, to: updateData.title };
    }

    // Publish realtime event synchronously (in-process bus, microseconds).
    publishEvent('issue.updated', session.user.id!, {
      projectId: currentIssue.projectId,
      issueId,
      sprintId: currentIssue.sprintId || undefined,
      organizationId: currentIssue.organizationId,
    });

    // Defer audit log and notification emails to after the response is sent.
    const actorUserId = session.user.id!;
    const projectName = currentIssue.key?.split('-')[0] || '';
    const changesSnapshot = changes;
    const newAssigneeId =
      updateData.assigneeId && updateData.assigneeId !== currentIssue.assigneeId
        ? updateData.assigneeId
        : null;
    const statusEmailRecipient =
      updateData.statusId &&
      updateData.statusId !== currentIssue.statusId &&
      currentIssue.assigneeId
        ? currentIssue.assigneeId
        : null;

    after(async () => {
      if (Object.keys(changesSnapshot).length > 0) {
        let action:
          | 'issue.status_changed'
          | 'issue.assigned'
          | 'issue.priority_changed'
          | 'issue.updated' = 'issue.updated';
        if (changesSnapshot.status) {
          action = 'issue.status_changed';
        } else if (changesSnapshot.assigneeId) {
          action = 'issue.assigned';
        } else if (changesSnapshot.priority) {
          action = 'issue.priority_changed';
        }
        try {
          await createAuditLog({
            userId: actorUserId,
            organizationId: currentIssue.organizationId,
            action,
            resourceType: 'issue',
            resourceId: issueId,
            projectId: currentIssue.projectId,
            issueId,
            changes: changesSnapshot,
          });
        } catch (err) {
          console.error('audit log failed', err);
        }
      }

      if (newAssigneeId) {
        try {
          await notifyIssueEvent({
            eventType: 'issue_assigned',
            recipientUserId: newAssigneeId,
            actorUserId,
            organizationId: currentIssue.organizationId,
            issueKey: currentIssue.key,
            issueTitle: currentIssue.title,
            projectName,
          });
        } catch (err) {
          console.error('assignee notification failed', err);
        }
      }

      if (statusEmailRecipient) {
        try {
          await notifyIssueEvent({
            eventType: 'issue_status_changed',
            recipientUserId: statusEmailRecipient,
            actorUserId,
            organizationId: currentIssue.organizationId,
            issueKey: currentIssue.key,
            issueTitle: currentIssue.title,
            projectName,
          });
        } catch (err) {
          console.error('status notification failed', err);
        }
      }
    });

    // --- Automation triggers (fire-and-forget) ---
    // Compute which fields changed between old and new so rules can match.
    const changedFields: string[] = [];
    const trackedFields: (keyof typeof updateData)[] = [
      'title',
      'description',
      'statusId',
      'priority',
      'assigneeId',
      'labels',
      'sprintId',
      'epicId',
      'parentId',
      'estimate',
      'dueDate',
      'customFields',
    ];
    for (const field of trackedFields) {
      if (updateData[field] === undefined) continue;
      const before = (currentIssue as Record<string, unknown>)[field];
      const after = (updateData as Record<string, unknown>)[field];
      if (before !== after) {
        changedFields.push(field as string);
      }
    }

    const statusChanged = !!updateData.statusId && updateData.statusId !== currentIssue.statusId;
    const assigneeChanged =
      updateData.assigneeId !== undefined && updateData.assigneeId !== currentIssue.assigneeId;

    // If status transitioned, look up the new status metadata so rule
    // conditions can match on name/category (nice-to-have per spec).
    let newStatus: { id: string; name: string; category: string } | null = null;
    if (statusChanged && updateData.statusId) {
      const [statusRow] = await db
        .select({
          id: workflowStatuses.id,
          name: workflowStatuses.name,
          category: workflowStatuses.category,
        })
        .from(workflowStatuses)
        .where(eq(workflowStatuses.id, updateData.statusId))
        .limit(1);
      if (statusRow) {
        newStatus = {
          id: statusRow.id,
          name: statusRow.name,
          category: statusRow.category as string,
        };
      }
    }

    const automationPayload = {
      before: currentIssue,
      after: updatedIssueData,
      changedFields,
      ...(newStatus ? { newStatus } : {}),
    };

    // Defer automation rule evaluation until after the response is sent.
    after(async () => {
      try {
        await runAutomations({
          trigger: 'issue.updated',
          organizationId: currentIssue.organizationId,
          projectId: currentIssue.projectId,
          payload: automationPayload,
          actorUserId,
        });
      } catch (err) {
        console.error('automation failed', err);
      }

      if (statusChanged) {
        try {
          await runAutomations({
            trigger: 'issue.status_changed',
            organizationId: currentIssue.organizationId,
            projectId: currentIssue.projectId,
            payload: automationPayload,
            actorUserId,
          });
        } catch (err) {
          console.error('automation failed', err);
        }
      }

      if (assigneeChanged) {
        try {
          await runAutomations({
            trigger: 'issue.assigned',
            organizationId: currentIssue.organizationId,
            projectId: currentIssue.projectId,
            payload: automationPayload,
            actorUserId,
          });
        } catch (err) {
          console.error('automation failed', err);
        }
      }
    });

    return NextResponse.json(updatedIssueData);
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
  }
});

// DELETE /api/issues/[issueId] - Delete an issue
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    // Get issue to check project and reporter
    const issue = await getIssueById(issueId);
    if (!issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }

    // Check permission to delete issues (with reporter check for own issues)
    const permission = await checkIssuePermission(
      session.user.id!,
      issue.projectId,
      'delete',
      issue.reporterId
    );
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    await deleteIssue(issueId);

    publishEvent('issue.deleted', session.user.id!, {
      projectId: issue.projectId,
      issueId,
      sprintId: issue.sprintId || undefined,
      organizationId: issue.organizationId,
    });

    return NextResponse.json({ success: true, id: issueId });
  } catch (error) {
    console.error('Error deleting issue:', error);
    return NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 });
  }
}
