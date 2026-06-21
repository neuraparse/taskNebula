import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  and,
  db,
  desc,
  eq,
  hasPermission as roleHasPermission,
  issues,
  organizationMembers,
  projectMembers,
  projectTemplates,
  projects,
  ROLE_DEFAULT_PERMISSIONS,
  templateUsages,
  users,
  workflows,
  workflowStatuses,
  type ProjectRole,
} from '@tasknebula/db';
import { createId } from '@paralleldrive/cuid2';
import { auth } from '@/auth';
import { sql } from 'drizzle-orm';
import { getTemplateAuthz } from '@/lib/templates/authz';

export const dynamic = 'force-dynamic';

const useTemplateSchema = z.object({
  /**
   * Overrides let the client customise a few top-level fields (e.g. project
   * name/key when instantiating a project template, or issue title when
   * instantiating an issue template) without needing to know the full payload
   * shape.
   */
  overrides: z
    .object({
      name: z.string().min(1).max(255).optional(),
      key: z.string().min(1).max(32).optional(),
      title: z.string().min(1).max(500).optional(),
      projectId: z.string().optional(),
      description: z.string().optional().nullable(),
    })
    .optional(),
});

type UsePayload = Record<string, any>;

// POST /api/templates/[id]/use — instantiate a template.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const userId = session.user.id;

  const [template] = await db
    .select()
    .from(projectTemplates)
    .where(eq(projectTemplates.id, id))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const authz = await getTemplateAuthz(userId, template.organizationId);
  if (!authz.isMember && !template.isPublic) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: z.infer<typeof useTemplateSchema> = {};
  try {
    const raw = await request.json().catch(() => ({}));
    body = useTemplateSchema.parse(raw ?? {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const payload = (template.payload ?? {}) as UsePayload;
  const overrides = body.overrides ?? {};

  try {
    if (template.kind === 'project') {
      return await instantiateProject({ template, payload, overrides, userId });
    }
    if (template.kind === 'issue') {
      return await instantiateIssue({ template, payload, overrides, userId });
    }
    if (template.kind === 'doc') {
      // Docs have their own permission model; return the payload and let the
      // client hand it off to /api/docs/pages creation.
      return NextResponse.json(
        {
          kind: 'doc',
          payload: { ...payload, ...overrides },
          templateId: template.id,
          message: 'Doc templates are applied client-side via /api/docs/pages.',
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: `Unsupported template kind: ${template.kind}` },
      { status: 400 }
    );
  } catch (error) {
    console.error('[api/templates/:id/use] failed', error);
    return NextResponse.json({ error: 'Failed to instantiate template' }, { status: 500 });
  } finally {
    // Best-effort usage bookkeeping. Counter increment must not fail the
    // primary instantiation; swallow + log any errors.
    db.update(projectTemplates)
      .set({ usageCount: sql`${projectTemplates.usageCount} + 1` })
      .where(eq(projectTemplates.id, template.id))
      .catch((err) => console.error('[templates] usageCount bump failed', err));
  }
}

async function instantiateProject({
  template,
  payload,
  overrides,
  userId,
}: {
  template: typeof projectTemplates.$inferSelect;
  payload: UsePayload;
  overrides: NonNullable<z.infer<typeof useTemplateSchema>['overrides']>;
  userId: string;
}) {
  const organizationId = template.organizationId;
  if (!organizationId) {
    return NextResponse.json(
      { error: 'Template has no organization; cannot create project.' },
      { status: 400 }
    );
  }

  // Verify caller can create projects in this organization.
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const canCreateProject = roleHasPermission(
    member?.role || '',
    'project:create',
    user?.isSuperAdmin === true
  );
  if (!canCreateProject) {
    return NextResponse.json(
      { error: 'Project creation requires project:create permission in this organization' },
      { status: 403 }
    );
  }

  const name = overrides.name ?? payload.name ?? template.name ?? 'Untitled project';
  const rawKey = overrides.key ?? payload.key ?? deriveKey(name);
  const key = rawKey.toUpperCase().slice(0, 10);
  const description = overrides.description ?? payload.description ?? null;

  // Key collision check.
  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.organizationId, organizationId), eq(projects.key, key)))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: `Project key "${key}" already exists. Pass overrides.key to disambiguate.` },
      { status: 409 }
    );
  }

  const [defaultWorkflow] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(and(eq(workflows.organizationId, organizationId), eq(workflows.isDefault, true)))
    .limit(1);

  const projectId = createId();
  const [created] = await db
    .insert(projects)
    .values({
      id: projectId,
      organizationId,
      key,
      name,
      description,
      status: 'active',
      settings: payload.settings ?? {},
      defaultWorkflowId: defaultWorkflow?.id ?? null,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  if (!created) {
    throw new Error('Project insert returned no row');
  }

  // Creator becomes product_owner, same as /api/projects POST.
  const role: ProjectRole = 'product_owner';
  const defaults = ROLE_DEFAULT_PERMISSIONS[role];
  const permissionValues: Record<string, string> = {};
  for (const [k, v] of Object.entries(defaults)) {
    permissionValues[k] = v ? 'true' : 'false';
  }
  await db.insert(projectMembers).values({
    id: createId(),
    projectId,
    userId,
    role,
    ...permissionValues,
    invitedBy: userId,
  });

  // Usage tracking row.
  await db
    .insert(templateUsages)
    .values({
      templateId: template.id,
      organizationId,
      userId,
      projectName: name,
      projectKey: key,
      customizations: overrides as any,
    })
    .catch((err) => console.error('[templates] usage insert failed', err));

  return NextResponse.json({ kind: 'project', resource: created }, { status: 201 });
}

async function instantiateIssue({
  template,
  payload,
  overrides,
  userId,
}: {
  template: typeof projectTemplates.$inferSelect;
  payload: UsePayload;
  overrides: NonNullable<z.infer<typeof useTemplateSchema>['overrides']>;
  userId: string;
}) {
  const projectIdInput = overrides.projectId ?? payload.projectId;
  if (!projectIdInput) {
    return NextResponse.json(
      {
        error:
          'An issue template requires overrides.projectId (or payload.projectId) to know where to create the issue.',
      },
      { status: 400 }
    );
  }

  // Resolve project by id OR key.
  let project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectIdInput))
    .limit(1)
    .then((r) => r[0]);

  if (!project) {
    project = await db
      .select()
      .from(projects)
      .where(eq(projects.key, String(projectIdInput).toUpperCase()))
      .limit(1)
      .then((r) => r[0]);
  }

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Membership check.
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, project.organizationId)
      )
    )
    .limit(1);
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!member && !user?.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let workflowId = project.defaultWorkflowId;
  if (!workflowId) {
    const [wf] = await db
      .select()
      .from(workflows)
      .where(
        and(eq(workflows.organizationId, project.organizationId), eq(workflows.isDefault, true))
      )
      .limit(1);
    workflowId = wf?.id ?? null;
  }

  if (!workflowId) {
    return NextResponse.json({ error: 'No workflow found for project' }, { status: 500 });
  }

  const allStatuses = await db
    .select()
    .from(workflowStatuses)
    .where(eq(workflowStatuses.workflowId, workflowId));

  const backlog = allStatuses
    .filter((s) => s.category === 'backlog')
    .sort((a, b) => a.position - b.position);
  const defaultStatus = backlog[0];
  if (!defaultStatus) {
    return NextResponse.json({ error: 'No backlog status found in workflow' }, { status: 500 });
  }

  const [lastIssue] = await db
    .select()
    .from(issues)
    .where(eq(issues.projectId, project.id))
    .orderBy(desc(issues.number))
    .limit(1);

  const nextNumber = lastIssue?.number ? lastIssue.number + 1 : 1;
  const title = overrides.title ?? payload.title ?? template.name ?? 'Untitled issue';
  const description = overrides.description ?? payload.description ?? null;
  const rawType = (payload.type ?? 'task') as string;
  const type = (['story', 'task', 'bug', 'epic'] as const).includes(rawType as any)
    ? (rawType as 'story' | 'task' | 'bug' | 'epic')
    : 'task';
  const rawPriority = (payload.priority ?? 'medium') as string;
  const priority = (['critical', 'high', 'medium', 'low', 'none'] as const).includes(
    rawPriority as any
  )
    ? (rawPriority as 'critical' | 'high' | 'medium' | 'low' | 'none')
    : 'medium';

  const [newIssue] = await db
    .insert(issues)
    .values({
      id: createId(),
      organizationId: project.organizationId,
      projectId: project.id,
      key: `${project.key}-${nextNumber}`,
      number: nextNumber,
      type,
      title,
      description,
      statusId: defaultStatus.id,
      priority,
      reporterId: userId,
      labels: Array.isArray(payload.labels) ? payload.labels : [],
      estimate: typeof payload.estimate === 'number' ? payload.estimate : null,
      customFields: payload.customFields ?? {},
      metadata: {},
      createdBy: userId,
      updatedBy: userId,
    })
    .returning();

  return NextResponse.json({ kind: 'issue', resource: newIssue }, { status: 201 });
}

function deriveKey(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return 'TMPL';
  const first = cleaned[0] ?? 'TMPL';
  if (cleaned.length === 1) return first.slice(0, 4).toUpperCase();
  return cleaned
    .slice(0, 4)
    .map((w) => (w && w[0]) || '')
    .join('')
    .toUpperCase();
}
