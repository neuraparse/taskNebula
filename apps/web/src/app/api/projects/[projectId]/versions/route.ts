import { NextRequest, NextResponse } from 'next/server';
import { db, projectVersions, issueFixVersions, issues } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { canManageProject, canReadProject } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const createVersionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(10000).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  releaseDate: z.coerce.date().optional().nullable(),
});

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

// GET /api/projects/[projectId]/versions - List versions with issue counts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await resolveProjectByIdOrKey(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    // 404 (not 403) so cross-org probing can't confirm the project exists
    if (!(await canReadProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const versions = await db
      .select()
      .from(projectVersions)
      .where(eq(projectVersions.projectId, project.id))
      .orderBy(asc(projectVersions.sortOrder), asc(projectVersions.name));

    // Per-version issue counts via issue_fix_versions
    let countsByVersion = new Map<string, { total: number; done: number }>();
    const versionIds = versions.map((v) => v.id);
    if (versionIds.length > 0) {
      const counts = await db
        .select({
          versionId: issueFixVersions.versionId,
          total: sql<number>`COUNT(*)::int`,
          done: sql<number>`COALESCE(SUM(CASE WHEN ${issues.resolution} IS NOT NULL THEN 1 ELSE 0 END), 0)::int`,
        })
        .from(issueFixVersions)
        .innerJoin(issues, eq(issueFixVersions.issueId, issues.id))
        .where(inArray(issueFixVersions.versionId, versionIds))
        .groupBy(issueFixVersions.versionId);

      countsByVersion = new Map(
        counts.map((c) => [c.versionId, { total: Number(c.total), done: Number(c.done) }])
      );
    }

    return NextResponse.json({
      versions: versions.map((version) => ({
        ...version,
        issueCount: countsByVersion.get(version.id)?.total ?? 0,
        doneIssueCount: countsByVersion.get(version.id)?.done ?? 0,
      })),
      total: versions.length,
    });
  } catch (error) {
    console.error('Error fetching project versions:', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}

// POST /api/projects/[projectId]/versions - Create a version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await resolveProjectByIdOrKey(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!(await canReadProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!(await canManageProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = createVersionSchema.parse(await request.json());

    const [existing] = await db
      .select({ id: projectVersions.id })
      .from(projectVersions)
      .where(and(eq(projectVersions.projectId, project.id), eq(projectVersions.name, body.name)))
      .limit(1);
    if (existing) {
      return NextResponse.json(
        { error: 'A version with this name already exists in this project' },
        { status: 409 }
      );
    }

    const [last] = await db
      .select({ sortOrder: projectVersions.sortOrder })
      .from(projectVersions)
      .where(eq(projectVersions.projectId, project.id))
      .orderBy(desc(projectVersions.sortOrder))
      .limit(1);

    const [version] = await db
      .insert(projectVersions)
      .values({
        id: createId(),
        organizationId: project.organizationId,
        projectId: project.id,
        name: body.name,
        description: body.description ?? null,
        startDate: body.startDate ?? null,
        releaseDate: body.releaseDate ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: 'A version with this name already exists in this project' },
        { status: 409 }
      );
    }
    console.error('Error creating project version:', error);
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
  }
}
