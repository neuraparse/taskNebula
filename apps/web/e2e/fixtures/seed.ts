/**
 * Deterministic seed helper for the Playwright suite.
 *
 * Creates (idempotently):
 *   - 1 organization: "E2E Workspace" (slug: e2e-workspace)
 *   - 1 admin user:    e2e-admin@tasknebula.test / E2eAdmin!2026
 *   - 1 project:       "E2E Project"  (key: E2E)
 *   - default workflow with statuses Backlog / In Progress / Done
 *   - 5 issues with stable keys E2E-1..E2E-5
 *
 * Run standalone:
 *   pnpm --filter @tasknebula/web exec tsx e2e/fixtures/seed.ts
 *
 * Used by `auth.setup.ts` (via `ensureSeed`) so the suite is self-contained
 * regardless of whether the demo seed has been applied.
 */

import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
// Import the schema directly to avoid pulling in `@tasknebula/db/client`,
// which would instantiate a postgres connection at module load time.
import * as schema from '../../../../packages/db/src/schema';

function getDatabaseConnectionString(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || 'postgres';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.DB_PORT || process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB || 'tasknebula';
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export const E2E_ADMIN = {
  email: 'e2e-admin@tasknebula.test',
  name: 'E2E Admin',
  password: 'E2eAdmin!2026',
} as const;

export const E2E_ORG = {
  name: 'E2E Workspace',
  slug: 'e2e-workspace',
} as const;

export const E2E_PROJECT = {
  key: 'E2E',
  name: 'E2E Project',
} as const;

export interface SeededIds {
  organizationId: string;
  userId: string;
  projectId: string;
  workflowId: string;
  statusIds: { backlog: string; inProgress: string; done: string };
  issueIds: string[];
}

let cachedSeed: SeededIds | null = null;

export async function ensureSeed(): Promise<SeededIds> {
  if (cachedSeed) return cachedSeed;

  const url = getDatabaseConnectionString();
  if (!url) throw new Error('DATABASE_URL not set — cannot seed e2e fixture');

  const client = postgres(url);
  const db = drizzle(client, { schema });

  try {
    // --- User ---------------------------------------------------------------
    const existingUser = (
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, E2E_ADMIN.email))
        .limit(1)
    )[0];

    const passwordHash = await bcrypt.hash(E2E_ADMIN.password, 10);
    const userId = existingUser?.id ?? createId();
    if (!existingUser) {
      await db.insert(schema.users).values({
        id: userId,
        email: E2E_ADMIN.email,
        name: E2E_ADMIN.name,
        password: passwordHash,
        settings: {},
        status: 'active',
        isSuperAdmin: true,
        emailVerified: new Date(),
      });
    }

    // --- Organization -------------------------------------------------------
    const existingOrg = (
      await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.slug, E2E_ORG.slug))
        .limit(1)
    )[0];
    const organizationId = existingOrg?.id ?? createId();
    if (!existingOrg) {
      await db.insert(schema.organizations).values({
        id: organizationId,
        name: E2E_ORG.name,
        slug: E2E_ORG.slug,
        settings: {},
        plan: 'growth',
        status: 'active',
      });
      await db.insert(schema.organizationMembers).values({
        id: createId(),
        organizationId,
        userId,
        role: 'owner',
      });
    }

    // --- Project ------------------------------------------------------------
    const existingProject = (
      await db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.key, E2E_PROJECT.key))
        .limit(1)
    )[0];
    const projectId = existingProject?.id ?? createId();
    if (!existingProject) {
      await db.insert(schema.projects).values({
        id: projectId,
        organizationId,
        key: E2E_PROJECT.key,
        name: E2E_PROJECT.name,
        description: 'Project used by Playwright suite. Do not modify manually.',
        leadId: userId,
        status: 'active',
        settings: {},
        createdBy: userId,
        updatedBy: userId,
      });
    }

    // --- Workflow + statuses -----------------------------------------------
    const existingWorkflow = (
      await db
        .select()
        .from(schema.workflows)
        .where(eq(schema.workflows.organizationId, organizationId))
        .limit(1)
    )[0];
    const workflowId = existingWorkflow?.id ?? createId();
    let backlogId: string;
    let inProgressId: string;
    let doneId: string;

    if (!existingWorkflow) {
      // Workflows are now scoped at the organization (workspace) level rather
      // than per-project — the project is linked via projectWorkflows or
      // similar separate table in the canonical schema.
      await db.insert(schema.workflows).values({
        id: workflowId,
        organizationId,
        name: 'Default Workflow',
        description: 'E2E default workflow',
        isDefault: true,
        createdBy: userId,
        updatedBy: userId,
      });

      backlogId = createId();
      inProgressId = createId();
      doneId = createId();
      await db.insert(schema.workflowStatuses).values([
        { id: backlogId, workflowId, name: 'Backlog', category: 'backlog', color: '#94a3b8', position: 0 },
        { id: inProgressId, workflowId, name: 'In Progress', category: 'in_progress', color: '#3b82f6', position: 1 },
        { id: doneId, workflowId, name: 'Done', category: 'done', color: '#22c55e', position: 2 },
      ]);
    } else {
      const statuses = await db
        .select()
        .from(schema.workflowStatuses)
        .where(eq(schema.workflowStatuses.workflowId, workflowId));
      const byCategory = (cat: string) => statuses.find((s) => s.category === cat);
      backlogId = byCategory('backlog')!.id;
      inProgressId = byCategory('in_progress')!.id;
      doneId = byCategory('done')!.id;
    }

    // --- 5 deterministic issues --------------------------------------------
    const issueIds: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const key = `${E2E_PROJECT.key}-${i}`;
      const existing = (
        await db
          .select()
          .from(schema.issues)
          .where(eq(schema.issues.key, key))
          .limit(1)
      )[0];
      if (existing) {
        issueIds.push(existing.id);
        continue;
      }
      const id = createId();
      issueIds.push(id);
      await db.insert(schema.issues).values({
        id,
        organizationId,
        projectId,
        key,
        number: i,
        type: i === 1 ? 'epic' : i === 5 ? 'bug' : 'task',
        title: `E2E seed issue ${i}`,
        description: 'Auto-generated by Playwright fixture',
        statusId: i <= 3 ? backlogId : i === 4 ? inProgressId : doneId,
        priority: i === 5 ? 'critical' : 'medium',
        assigneeId: userId,
        reporterId: userId,
        labels: ['e2e'],
        estimate: 3,
        customFields: {},
        metadata: {},
        createdBy: userId,
        updatedBy: userId,
      });
    }

    cachedSeed = {
      organizationId,
      userId,
      projectId,
      workflowId,
      statusIds: { backlog: backlogId, inProgress: inProgressId, done: doneId },
      issueIds,
    };
    return cachedSeed;
  } finally {
    await client.end();
  }
}

// Allow running directly: `tsx e2e/fixtures/seed.ts`
if (require.main === module) {
  ensureSeed()
    .then((ids) => {
      // eslint-disable-next-line no-console
      console.log('E2E seed complete:', ids);
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('E2E seed failed:', err);
      process.exit(1);
    });
}
