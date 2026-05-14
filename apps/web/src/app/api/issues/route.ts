import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { getIssues, createIssue, createActivity, createAuditLog, db, projects, issues, workflowStatuses, workflows, users, projectMembers, organizationMembers } from '@tasknebula/db';
import { auth } from '@/auth';
import { createId } from '@paralleldrive/cuid2';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';
import { publishEvent } from '@/lib/realtime/events';
import { notifyIssueEvent } from '@/lib/notifications/send-notification';
import { runAutomations } from '@/lib/automation/evaluator';

// Permission check helper for issues
async function checkIssuePermission(
  userId: string,
  projectId: string,
  action: 'view' | 'create' | 'edit' | 'delete'
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

  // Get project membership
  const [projectMember] = await db
    .select({
      role: projectMembers.role,
      canDeleteIssues: projectMembers.canDeleteIssues,
    })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        eq(projectMembers.projectId, projectId)
      )
    )
    .limit(1);

  if (!projectMember) {
    // Org admins can view but not modify
    if (orgMember?.role === 'admin' && action === 'view') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Not a project member' };
  }

  // Check role-based permissions
  const issueCreateRoles = ['product_owner', 'scrum_master', 'tech_lead', 'developer', 'qa_engineer', 'designer'];
  const issueDeleteRoles = ['product_owner', 'tech_lead'];

  if (action === 'view') {
    return { allowed: true };
  }

  if (action === 'create' || action === 'edit') {
    if (issueCreateRoles.includes(projectMember.role)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Insufficient permissions to create/edit issues' };
  }

  if (action === 'delete') {
    if (issueDeleteRoles.includes(projectMember.role) || projectMember.canDeleteIssues) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Insufficient permissions to delete issues' };
  }

  return { allowed: false, reason: 'Unknown action' };
}

// Validation schema for creating an issue
const createIssueSchema = z.object({
  projectId: z.string(),
  type: z.enum(['story', 'task', 'bug', 'epic']),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  priority: z.enum(['critical', 'high', 'medium', 'low', 'none']).default('medium'),
  assigneeId: z.string().optional(),
  labels: z.array(z.string()).default([]),
  sprintId: z.string().optional(),
  epicId: z.string().optional(),
  parentId: z.string().optional(),
  estimate: z.number().optional(),
  dueDate: z.string().datetime().optional(),
  customFields: z.record(z.any()).default({}),
  statusId: z.string().optional(),
});

// GET /api/issues - List issues with filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const projectIdParam = searchParams.get('projectId');
    const assigneeId = searchParams.get('assigneeId');
    const statusParam = searchParams.get('status');
    const sprintId = searchParams.get('sprintId');
    const parentId = searchParams.get('parentId');
    const type = searchParams.get('type');

    // If projectId looks like a key (e.g., "demo", "PROJ"), convert to ID
    let actualProjectId = projectIdParam;
    if (projectIdParam && !projectIdParam.includes('_')) {
      // Looks like a key, find the project by key
      const projectByKey = await db
        .select()
        .from(projects)
        .where(eq(projects.key, projectIdParam.toUpperCase()))
        .limit(1);

      if (projectByKey[0]) {
        actualProjectId = projectByKey[0].id;
      }
    }

    // Determine accessible organization scope (super admin bypasses)
    const [currentUser] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const isSuperAdmin = currentUser?.isSuperAdmin === true;

    // Load orgs the caller is a member of
    const orgMemberships = await db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, session.user.id));
    const accessibleOrgIds = orgMemberships.map((m) => m.organizationId);

    // If projectId was given, verify the caller can access that project's org
    if (actualProjectId) {
      const [project] = await db
        .select({ id: projects.id, organizationId: projects.organizationId })
        .from(projects)
        .where(eq(projects.id, actualProjectId))
        .limit(1);

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      if (!isSuperAdmin && !accessibleOrgIds.includes(project.organizationId)) {
        // Fall back to project membership check
        const [projectMember] = await db
          .select({ userId: projectMembers.userId })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.userId, session.user.id),
              eq(projectMembers.projectId, actualProjectId)
            )
          )
          .limit(1);

        if (!projectMember) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    } else if (!isSuperAdmin && accessibleOrgIds.length === 0) {
      // No projectId and no org memberships — caller sees nothing
      return NextResponse.json({ issues: [], total: 0 });
    }

    // Build query with joins
    let query = db
      .select({
        id: issues.id,
        organizationId: issues.organizationId,
        projectId: issues.projectId,
        key: issues.key,
        number: issues.number,
        type: issues.type,
        title: issues.title,
        description: issues.description,
        statusId: issues.statusId,
        priority: issues.priority,
        assigneeId: issues.assigneeId,
        reporterId: issues.reporterId,
        labels: issues.labels,
        sprintId: issues.sprintId,
        epicId: issues.epicId,
        parentId: issues.parentId,
        estimate: issues.estimate,
        dueDate: issues.dueDate,
        createdAt: issues.createdAt,
        updatedAt: issues.updatedAt,
        status: workflowStatuses.category,
        statusName: workflowStatuses.name,
        statusColor: workflowStatuses.color,
        assignee: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .leftJoin(users, eq(issues.assigneeId, users.id))
      .orderBy(desc(issues.createdAt));

    // Apply filters
    const conditions = [];
    if (actualProjectId) {
      conditions.push(eq(issues.projectId, actualProjectId));
    } else if (!isSuperAdmin) {
      // No projectId: restrict to issues belonging to orgs the caller is in
      conditions.push(inArray(issues.organizationId, accessibleOrgIds));
    }
    if (assigneeId) {
      conditions.push(eq(issues.assigneeId, assigneeId));
    }
    if (statusParam) {
      conditions.push(eq(workflowStatuses.category, statusParam as any));
    }
    // Handle sprintId filter - 'none' means backlog (no sprint assigned)
    if (sprintId === 'none') {
      conditions.push(sql`${issues.sprintId} IS NULL`);
    } else if (sprintId) {
      conditions.push(eq(issues.sprintId, sprintId));
    }
    // Handle parentId filter for subtasks
    if (parentId) {
      conditions.push(eq(issues.parentId, parentId));
    }
    if (type) {
      conditions.push(eq(issues.type, type as any));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const issuesData = await query;

    return NextResponse.json({
      issues: issuesData,
      total: issuesData.length,
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    return NextResponse.json({ error: 'Failed to fetch issues' }, { status: 500 });
  }
}

// POST /api/issues - Create a new issue
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createIssueSchema.parse(body);

    // If projectId looks like a key (e.g., "demo", "PROJ"), convert to ID
    let actualProjectId = validatedData.projectId;

    if (!validatedData.projectId.includes('_')) {
      // Looks like a key, find the project by key
      const projectByKey = await db
        .select()
        .from(projects)
        .where(eq(projects.key, validatedData.projectId.toUpperCase()))
        .limit(1);

      if (projectByKey[0]) {
        actualProjectId = projectByKey[0].id;
      }
    }

    // Get project to get organization ID and generate issue number
    const projectResults = await db
      .select()
      .from(projects)
      .where(eq(projects.id, actualProjectId))
      .limit(1);

    const project = projectResults[0];
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check permission to create issues
    const permission = await checkIssuePermission(session.user.id!, actualProjectId, 'create');
    if (!permission.allowed) {
      return NextResponse.json(
        { error: permission.reason || 'Permission denied' },
        { status: 403 }
      );
    }

    // Get the next issue number for this project
    const lastIssueResults = await db
      .select()
      .from(issues)
      .where(eq(issues.projectId, actualProjectId))
      .orderBy(desc(issues.number))
      .limit(1);

    const nextNumber = lastIssueResults[0] ? (lastIssueResults[0].number || 0) + 1 : 1;
    const issueKey = `${project.key}-${nextNumber}`;

    // Get default workflow for the project
    let workflowId = project.defaultWorkflowId;

    if (!workflowId) {
      // Get organization's default workflow
      const defaultWorkflows = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.organizationId, project.organizationId),
            eq(workflows.isDefault, true)
          )
        )
        .limit(1);

      const defaultWorkflow = defaultWorkflows[0];
      if (!defaultWorkflow) {
        return NextResponse.json({ error: 'No workflow found for project' }, { status: 500 });
      }

      workflowId = defaultWorkflow.id;
    }

    // Get workflow statuses
    const allStatuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId));

    // Resolve the final status: prefer the client-supplied statusId when it
    // belongs to this workflow; otherwise fall back to the first backlog status.
    let finalStatusId: string | undefined;
    if (validatedData.statusId) {
      const match = allStatuses.find(s => s.id === validatedData.statusId);
      if (match) {
        finalStatusId = match.id;
      }
      // Unrecognised / cross-workflow statusId: silently fall through to backlog default.
    }

    if (!finalStatusId) {
      const backlogStatuses = allStatuses
        .filter(s => s.category === 'backlog')
        .sort((a, b) => a.position - b.position);
      const defaultStatus = backlogStatuses[0];
      if (!defaultStatus) {
        return NextResponse.json({ error: 'No backlog status found in workflow' }, { status: 500 });
      }
      finalStatusId = defaultStatus.id;
    }

    const issueData = {
      id: createId(),
      organizationId: project.organizationId,
      projectId: actualProjectId,
      key: issueKey,
      number: nextNumber,
      title: validatedData.title,
      description: validatedData.description || null,
      statusId: finalStatusId,
      priority: validatedData.priority,
      type: validatedData.type,
      reporterId: session.user.id,
      assigneeId: validatedData.assigneeId || null,
      sprintId: validatedData.sprintId || null,
      parentId: validatedData.parentId || null,
      estimate: validatedData.estimate || null,
      labels: validatedData.labels || [],
      customFields: validatedData.customFields || {},
      metadata: {},
      createdBy: session.user.id,
      updatedBy: session.user.id,
    };

    // Insert issue directly using db.insert
    let newIssue;
    try {
      const newIssueResults = await db
        .insert(issues)
        .values(issueData)
        .returning();
      newIssue = newIssueResults[0];
      if (!newIssue) {
        throw new Error('Failed to create issue');
      }

      // Publish realtime event synchronously so other clients see the new
      // issue immediately (in-process bus, ~microseconds).
      publishEvent('issue.created', session.user.id!, {
        projectId: newIssue.projectId,
        issueId: newIssue.id,
        sprintId: newIssue.sprintId || undefined,
        organizationId: newIssue.organizationId,
      });
    } catch (insertError) {
      console.error('Insert error details:', insertError);
      throw insertError;
    }

    // Defer all post-response side-effects: activity log, audit log,
    // assignee notification email, and automation rules. The response
    // payload is finalised below — `after()` runs once it has been flushed
    // to the client, so request latency reflects only the DB insert.
    const actorUserId = session.user.id!;
    const createdIssue = newIssue;
    const projectKey = project.key;
    after(async () => {
      try {
        await createActivity({
          issueId: createdIssue.id,
          userId: actorUserId,
          type: 'created',
        });
      } catch (err) {
        console.error('activity log failed', err);
      }

      try {
        await createAuditLog({
          userId: actorUserId,
          organizationId: createdIssue.organizationId,
          action: 'issue.created',
          resourceType: 'issue',
          resourceId: createdIssue.id,
          projectId: createdIssue.projectId,
          issueId: createdIssue.id,
          metadata: { issueKey: createdIssue.key, title: createdIssue.title },
        });
      } catch (err) {
        console.error('audit log failed', err);
      }

      if (createdIssue.assigneeId) {
        try {
          await notifyIssueEvent({
            eventType: 'issue_assigned',
            recipientUserId: createdIssue.assigneeId,
            actorUserId,
            organizationId: createdIssue.organizationId,
            issueKey: createdIssue.key,
            issueTitle: createdIssue.title,
            projectName: projectKey,
          });
        } catch (err) {
          console.error('assignee notification failed', err);
        }
      }

      try {
        await runAutomations({
          trigger: 'issue.created',
          organizationId: createdIssue.organizationId,
          projectId: createdIssue.projectId,
          payload: createdIssue,
          actorUserId,
        });
      } catch (err) {
        console.error('automation failed', err);
      }
    });

    return NextResponse.json(newIssue, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors);
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating issue:', error);
    return NextResponse.json({ error: 'Failed to create issue' }, { status: 500 });
  }
}
