/**
 * Applies a {@link WorkspaceSeed} to the database inside a single
 * transaction. On any error the transaction rolls back, so the workspace
 * is left untouched (no half-baked partial seeds).
 *
 * The seed is generated separately (see ./bootstrapper.ts) so the user can
 * review and edit it before applying.
 */

import {
  db,
  organizations,
  organizationMembers,
  teams,
  teamMembers,
  projects,
  projectMembers,
  workflows,
  workflowStatuses,
  sprints,
  issues,
  users,
  ROLE_DEFAULT_PERMISSIONS,
  hasPermission as roleHasPermission,
  type ProjectRole,
} from '@tasknebula/db';
import { and, eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { workspaceSeedSchema, type WorkspaceSeed } from './bootstrapper';

export class ApplySeedError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApplySeedError';
  }
}

export interface ApplySeedInput {
  seed: WorkspaceSeed;
  organizationId: string;
  userId: string;
}

export interface ApplySeedResult {
  projectId: string;
  projectKey: string;
  teamIds: string[];
  cycleIds: string[];
  issueIds: string[];
}

/**
 * Applies the validated seed transactionally. Throws on any failure so the
 * caller can return a 5xx and the DB will roll back.
 */
export async function applyWorkspaceSeed(input: ApplySeedInput): Promise<ApplySeedResult> {
  const parsed = workspaceSeedSchema.safeParse(input.seed);
  if (!parsed.success) {
    throw new ApplySeedError(
      'schema_violation',
      `Seed failed validation: ${parsed.error.errors
        .slice(0, 3)
        .map((e) => `${e.path.join('.')} ${e.message}`)
        .join('; ')}`
    );
  }
  const seed = parsed.data;

  // Pre-flight checks outside the transaction (cheaper to short-circuit).
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  if (!org) {
    throw new ApplySeedError('not_found', 'Organization does not exist.');
  }
  const [member] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, input.organizationId),
        eq(organizationMembers.userId, input.userId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);
  const [actor] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const canApply = roleHasPermission(member?.role || '', 'org:settings', actor?.isSuperAdmin);
  if (!canApply) {
    throw new ApplySeedError(
      'forbidden',
      'Applying a workspace seed requires organization settings permission.'
    );
  }

  // Resolve / ensure a default workflow exists for the org. We need this for
  // the first status (initial "To Do") so issues can be created.
  const [existingWorkflow] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(and(eq(workflows.organizationId, input.organizationId), eq(workflows.isDefault, true)))
    .limit(1);

  return db.transaction(async (tx) => {
    // 1) Workflow + statuses
    let workflowId = existingWorkflow?.id;
    let initialStatusId: string | undefined;

    if (!workflowId) {
      workflowId = createId();
      await tx.insert(workflows).values({
        id: workflowId,
        organizationId: input.organizationId,
        name: 'Default Workflow',
        description: 'Default workflow created by AI bootstrapper',
        isDefault: true,
        createdBy: input.userId,
        updatedBy: input.userId,
      });
      initialStatusId = createId();
      const inProgressId = createId();
      const doneId = createId();
      await tx.insert(workflowStatuses).values([
        {
          id: initialStatusId,
          workflowId,
          name: 'To Do',
          category: 'backlog',
          color: '#94a3b8',
          position: 0,
        },
        {
          id: inProgressId,
          workflowId,
          name: 'In Progress',
          category: 'in_progress',
          color: '#3b82f6',
          position: 1,
        },
        {
          id: doneId,
          workflowId,
          name: 'Done',
          category: 'done',
          color: '#10b981',
          position: 2,
        },
      ]);
    } else {
      const [firstStatus] = await tx
        .select({ id: workflowStatuses.id })
        .from(workflowStatuses)
        .where(eq(workflowStatuses.workflowId, workflowId))
        .orderBy(workflowStatuses.position)
        .limit(1);
      if (!firstStatus) {
        throw new ApplySeedError('invalid_state', 'Default workflow has no statuses.');
      }
      initialStatusId = firstStatus.id;
    }

    // 2) Teams
    const teamIds: string[] = [];
    for (const team of seed.teams) {
      // Ensure slug uniqueness inside this org by suffixing on conflict.
      const slug = await uniqueTeamSlug(tx, input.organizationId, team.slug);
      const teamId = createId();
      await tx.insert(teams).values({
        id: teamId,
        organizationId: input.organizationId,
        name: team.name,
        slug,
        settings: {},
      });
      teamIds.push(teamId);
      // Add the actor as a lead of the first team for convenience.
      if (teamIds.length === 1) {
        await tx.insert(teamMembers).values({
          id: createId(),
          teamId,
          userId: input.userId,
          role: 'lead',
        });
      }
    }

    // 3) Project (unique key per org).
    const projectKey = await uniqueProjectKey(tx, input.organizationId, seed.projectKey);
    const projectId = createId();
    await tx.insert(projects).values({
      id: projectId,
      organizationId: input.organizationId,
      teamId: teamIds[0] ?? null,
      key: projectKey,
      name: seed.projectName,
      description: null,
      status: 'active',
      settings: {
        bootstrapper: {
          createdBy: 'p1-13-bootstrapper',
          labels: seed.labels,
          priorities: seed.priorities,
        },
      },
      defaultWorkflowId: workflowId,
      createdBy: input.userId,
      updatedBy: input.userId,
    });

    // Add the creator as product_owner with full permissions.
    const role: ProjectRole = 'product_owner';
    const defaults = ROLE_DEFAULT_PERMISSIONS[role];
    const permissionValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(defaults)) {
      permissionValues[k] = v ? 'true' : 'false';
    }
    await tx.insert(projectMembers).values({
      id: createId(),
      projectId,
      userId: input.userId,
      role,
      ...permissionValues,
      invitedBy: input.userId,
    });

    // 4) Sprints (cycles)
    const cycleIds: string[] = [];
    for (const cycle of seed.cycles) {
      const sprintId = createId();
      const startDate = new Date(cycle.startDate);
      const endDate = new Date(cycle.endDate);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new ApplySeedError('invalid_input', `cycle "${cycle.name}" has invalid dates.`);
      }
      if (endDate <= startDate) {
        throw new ApplySeedError(
          'invalid_input',
          `cycle "${cycle.name}" endDate must be after startDate.`
        );
      }
      await tx.insert(sprints).values({
        id: sprintId,
        projectId,
        name: cycle.name,
        startDate,
        endDate,
        status: 'planned',
        createdBy: input.userId,
        updatedBy: input.userId,
      });
      cycleIds.push(sprintId);
    }

    // 5) Issues. Spread across cycles roughly evenly.
    const issueIds: string[] = [];
    for (let i = 0; i < seed.issues.length; i++) {
      const item = seed.issues[i]!;
      const issueId = createId();
      const sprintId = cycleIds.length > 0 ? cycleIds[i % cycleIds.length]! : null;
      // Convert estimateHours -> integer hours (the existing `estimate` field
      // is integer and the rest of the app treats it as story points / hours
      // depending on workspace settings; we store hours here).
      const estimate = typeof item.estimateHours === 'number' ? item.estimateHours : null;
      await tx.insert(issues).values({
        id: issueId,
        organizationId: input.organizationId,
        projectId,
        key: `${projectKey}-${i + 1}`,
        number: i + 1,
        type: 'task',
        title: item.title,
        description: item.description ?? null,
        statusId: initialStatusId,
        priority: item.priority,
        assigneeId: null,
        reporterId: input.userId,
        labels: item.labels,
        sprintId,
        estimate,
        customFields: {},
        metadata: {
          assigneeRole: item.assigneeRole ?? null,
          source: 'p1-13-bootstrapper',
        },
        createdBy: input.userId,
        updatedBy: input.userId,
      });
      issueIds.push(issueId);
    }

    return {
      projectId,
      projectKey,
      teamIds,
      cycleIds,
      issueIds,
    };
  });
}

async function uniqueTeamSlug(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  for (let attempt = 0; attempt < 20; attempt++) {
    const [existing] = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.organizationId, organizationId), eq(teams.slug, slug)))
      .limit(1);
    if (!existing) return slug;
    slug = `${baseSlug}-${attempt + 2}`;
  }
  // Last-resort fallback so we never spin forever.
  return `${baseSlug}-${Date.now().toString(36)}`;
}

async function uniqueProjectKey(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  baseKey: string
): Promise<string> {
  let key = baseKey.toUpperCase();
  for (let attempt = 0; attempt < 20; attempt++) {
    const [existing] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.key, key)))
      .limit(1);
    if (!existing) return key;
    const suffix = (attempt + 2).toString();
    key = `${baseKey.slice(0, Math.max(2, 8 - suffix.length))}${suffix}`.toUpperCase();
  }
  // last-resort: pseudo-random suffix
  return `${baseKey.slice(0, 4)}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`.toUpperCase();
}

// Re-exports for callers/tests.
export { workspaceSeedSchema };
