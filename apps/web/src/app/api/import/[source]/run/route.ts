import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  ROLE_DEFAULT_PERMISSIONS,
  db,
  hasPermission as roleHasPermission,
  importJobs,
  organizationMembers,
  projectMembers,
  projects,
  users,
  eq,
  and,
  type ProjectRole,
} from '@tasknebula/db';
import { isImportSource, type ImportSource } from '@/lib/importers';
import { executeImportJob } from '@/lib/importers/runner';

export const dynamic = 'force-dynamic';

type MappingRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MappingRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toBool(value: unknown): boolean {
  return value === true || value === 'true';
}

function compactRecord(record: MappingRecord): MappingRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

async function canCreateImportedIssues(args: {
  userId: string;
  workspaceId: string;
  projectId: string;
}): Promise<{ allowed: boolean; status: 403 | 404; error: string }> {
  const { userId, workspaceId, projectId } = args;

  const [project] = await db
    .select({ id: projects.id, organizationId: projects.organizationId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, workspaceId)))
    .limit(1);

  if (!project) {
    return { allowed: false, status: 404, error: 'Project not found' };
  }

  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.isSuperAdmin) {
    return { allowed: true, status: 403, error: '' };
  }

  const [orgMember] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, workspaceId),
        eq(organizationMembers.status, 'active')
      )
    )
    .limit(1);

  if (!orgMember) {
    return { allowed: false, status: 403, error: 'Forbidden' };
  }

  if (roleHasPermission(orgMember.role || '', 'project:manage')) {
    return { allowed: true, status: 403, error: '' };
  }

  const [projectMember] = await db
    .select({
      role: projectMembers.role,
      canCreateIssues: projectMembers.canCreateIssues,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  if (!projectMember) {
    return { allowed: false, status: 403, error: 'Forbidden' };
  }

  const roleDefaults =
    ROLE_DEFAULT_PERMISSIONS[projectMember.role as ProjectRole] || ROLE_DEFAULT_PERMISSIONS.viewer;
  const allowed = toBool(projectMember.canCreateIssues) || roleDefaults.canCreateIssues;
  return {
    allowed,
    status: 403,
    error: allowed ? '' : 'Insufficient permissions to create imported issues',
  };
}

function sanitizeConfig(source: ImportSource, config: MappingRecord): MappingRecord {
  switch (source) {
    case 'linear':
      return compactRecord({
        teamKey: typeof config.teamKey === 'string' ? config.teamKey : undefined,
        first: typeof config.first === 'number' ? config.first : undefined,
      });
    case 'jira':
      return compactRecord({
        site: typeof config.site === 'string' ? config.site : undefined,
        email: typeof config.email === 'string' ? config.email : undefined,
        jql: typeof config.jql === 'string' ? config.jql : undefined,
        maxResults: typeof config.maxResults === 'number' ? config.maxResults : undefined,
      });
    case 'github':
      return compactRecord({
        owner: typeof config.owner === 'string' ? config.owner : undefined,
        repo: typeof config.repo === 'string' ? config.repo : undefined,
        perPage: typeof config.perPage === 'number' ? config.perPage : undefined,
        maxPages: typeof config.maxPages === 'number' ? config.maxPages : undefined,
      });
    case 'csv':
      return {};
    default:
      return {};
  }
}

function buildRuntimeSourceInput(source: ImportSource, config: MappingRecord): unknown | undefined {
  if (source === 'csv') return undefined;
  return config;
}

/**
 * POST /api/import/[source]/run
 *
 * Creates an `import_jobs` row in 'pending' state and kicks off the
 * runner asynchronously. Returns the job id immediately so the UI can
 * start polling `/api/import/jobs/[id]` for progress.
 *
 * Request body:
 *   {
 *     workspaceId: string,    // required
 *     projectId:   string,    // target project for imported issues
 *     mapping:     ImportMapping & adapter-specific config,
 *     csvText?:    string,    // CSV only — raw payload
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { source } = await params;
  if (!isImportSource(source)) {
    return NextResponse.json({ error: `Unknown import source: ${source}` }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : null;
  const projectId = typeof body.projectId === 'string' ? body.projectId : null;
  if (!workspaceId || !projectId) {
    return NextResponse.json({ error: 'workspaceId and projectId are required' }, { status: 400 });
  }

  const importAccess = await canCreateImportedIssues({
    userId: session.user.id,
    workspaceId,
    projectId,
  });
  if (!importAccess.allowed) {
    return NextResponse.json({ error: importAccess.error }, { status: importAccess.status });
  }

  const bodyMapping = isRecord(body.mapping) ? body.mapping : {};
  const bodyConfig = isRecord(bodyMapping.config) ? bodyMapping.config : {};
  const runtimeSourceInput = buildRuntimeSourceInput(source, bodyConfig);
  const sanitizedConfig = sanitizeConfig(source, bodyConfig);
  const mapping = {
    ...bodyMapping,
    config: sanitizedConfig,
    projectId,
    // For CSV, stash the raw text inside mapping so the runner can
    // re-parse without a separate object store. For other sources we
    // keep only non-secret config; credentials stay in memory for the
    // immediate in-process runner call below.
    csvText: source === 'csv' && typeof body.csvText === 'string' ? body.csvText : undefined,
  };
  for (const key of [
    'preview',
    'apiKey',
    'apiToken',
    'accessToken',
    'refreshToken',
    'clientSecret',
    'password',
    'authorization',
  ]) {
    delete (mapping as MappingRecord)[key];
  }

  const [job] = await db
    .insert(importJobs)
    .values({
      workspaceId,
      source,
      status: 'pending',
      mapping,
      createdBy: session.user.id,
    })
    .returning();

  if (!job) {
    return NextResponse.json({ error: 'Failed to create import job' }, { status: 500 });
  }

  // Fire-and-forget. When a real queue lands (BullMQ / pg-boss), replace
  // this with an enqueue call.
  const jobId = job.id;
  void executeImportJob(jobId, runtimeSourceInput).catch((err) => {
    console.error('[import] runner failed', jobId, err);
  });

  return NextResponse.json({ jobId, status: job.status }, { status: 201 });
}
