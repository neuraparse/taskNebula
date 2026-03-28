import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIssues, createIssue, createActivity, createAuditLog, db, projects, issues, workflowStatuses, workflows, users, projectMembers, organizationMembers } from '@tasknebula/db';
import { auth } from '@/auth';
import { createId } from '@paralleldrive/cuid2';
import { eq, and, desc, asc, sql } from 'drizzle-orm';

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
});

// GET /api/issues - List issues with filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    let projectIdParam = searchParams.get('projectId');
    const assigneeId = searchParams.get('assigneeId');
    const statusParam = searchParams.get('status');
    const sprintId = searchParams.get('sprintId');
    const parentId = searchParams.get('parentId');

    // If projectId looks like a key (e.g., "demo", "PROJ"), convert to ID
    let actualProjectId = projectIdParam;
    if (projectIdParam && !projectIdParam.includes('_')) {
      // Looks like a key, find the project by key
      const projectByKey = await db
        .select()
        .from(projects)
        .where(eq(projects.key, projectIdParam.toUpperCase()))
        .limit(1);

      if (projectByKey.length > 0) {
        actualProjectId = projectByKey[0].id;
      }
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
        assignee: users,
      })
      .from(issues)
      .leftJoin(workflowStatuses, eq(issues.statusId, workflowStatuses.id))
      .leftJoin(users, eq(issues.assigneeId, users.id))
      .orderBy(desc(issues.createdAt));

    // Apply filters
    const conditions = [];
    if (actualProjectId) {
      conditions.push(eq(issues.projectId, actualProjectId));
    }
    if (assigneeId) {
      conditions.push(eq(issues.assigneeId, assigneeId));
    }
    if (statusParam) {
      conditions.push(eq(workflowStatuses.category, statusParam));
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

      if (projectByKey.length > 0) {
        actualProjectId = projectByKey[0].id;
      }
    }

    // Get project to get organization ID and generate issue number
    const projectResults = await db
      .select()
      .from(projects)
      .where(eq(projects.id, actualProjectId))
      .limit(1);

    if (projectResults.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResults[0];

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

    const nextNumber = lastIssueResults.length > 0 ? (lastIssueResults[0].number || 0) + 1 : 1;
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

      if (defaultWorkflows.length === 0) {
        return NextResponse.json({ error: 'No workflow found for project' }, { status: 500 });
      }

      workflowId = defaultWorkflows[0].id;
    }

    // Get workflow statuses
    const allStatuses = await db
      .select()
      .from(workflowStatuses)
      .where(eq(workflowStatuses.workflowId, workflowId));

    // Filter for backlog category and sort by position
    const backlogStatuses = allStatuses
      .filter(s => s.category === 'backlog')
      .sort((a, b) => a.position - b.position);

    if (backlogStatuses.length === 0) {
      return NextResponse.json({ error: 'No backlog status found in workflow' }, { status: 500 });
    }

    const defaultStatus = backlogStatuses[0];

    const issueData = {
      id: createId(),
      organizationId: project.organizationId,
      projectId: actualProjectId,
      key: issueKey,
      number: nextNumber,
      title: validatedData.title,
      description: validatedData.description || null,
      statusId: defaultStatus.id,
      priority: validatedData.priority,
      type: validatedData.type,
      reporterId: session.user.id,
      assigneeId: validatedData.assigneeId || null,
      sprintId: validatedData.sprintId || null,
      parentId: validatedData.parentId || null,
      estimate: validatedData.estimate || null,
      labels: validatedData.labels || [],
      customFields: validatedData.customFields || {},
      metadata: validatedData.customFields || {},
      createdBy: session.user.id,
      updatedBy: session.user.id,
    };

    console.log('Creating issue with data:', JSON.stringify(issueData, null, 2));

    // Insert issue directly using db.insert
    let newIssue;
    try {
      const newIssueResults = await db
        .insert(issues)
        .values(issueData)
        .returning();
      newIssue = newIssueResults[0];
      console.log('Issue created successfully:', newIssue);

      // Create activity log for issue creation
      await createActivity({
        issueId: newIssue.id,
        userId: session.user.id,
        type: 'created',
      });

      // Create audit log for issue creation
      await createAuditLog({
        userId: session.user.id,
        organizationId: newIssue.organizationId,
        action: 'issue.created',
        resourceType: 'issue',
        resourceId: newIssue.id,
        projectId: newIssue.projectId,
        issueId: newIssue.id,
        metadata: { issueKey: newIssue.key, title: newIssue.title },
      });
    } catch (insertError) {
      console.error('Insert error details:', insertError);
      throw insertError;
    }
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
    return NextResponse.json({
      error: 'Failed to create issue',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

