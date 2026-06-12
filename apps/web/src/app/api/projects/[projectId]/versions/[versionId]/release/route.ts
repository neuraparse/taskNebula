import { NextRequest, NextResponse } from 'next/server';
import { db, projectVersions, issueFixVersions, issues } from '@tasknebula/db';
import { auth } from '@/auth';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { resolveProjectByIdOrKey } from '@/lib/projects/server';
import { canManageProject, canReadProject } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const releaseVersionSchema = z.object({
  // Optional: re-point unresolved issues' fix-version to another version of the same project.
  moveOpenIssuesToVersionId: z.string().optional(),
});

// POST /api/projects/[projectId]/versions/[versionId]/release - Mark a version released
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; versionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, versionId } = await params;
    const project = await resolveProjectByIdOrKey(projectId, session.user.id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    // 404 (not 403) so cross-org probing can't confirm the project exists
    if (!(await canReadProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!(await canManageProject(session.user.id, project))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Body is optional ({} when absent)
    const rawBody = await request.text();
    let parsedBody: unknown = {};
    if (rawBody.trim().length > 0) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
    }
    const body = releaseVersionSchema.parse(parsedBody);

    const [version] = await db
      .select()
      .from(projectVersions)
      .where(and(eq(projectVersions.id, versionId), eq(projectVersions.projectId, project.id)))
      .limit(1);
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    const targetVersionId = body.moveOpenIssuesToVersionId;
    if (targetVersionId) {
      if (targetVersionId === version.id) {
        return NextResponse.json(
          { error: 'Cannot move open issues to the version being released' },
          { status: 400 }
        );
      }
      const [targetVersion] = await db
        .select({ id: projectVersions.id })
        .from(projectVersions)
        .where(
          and(eq(projectVersions.id, targetVersionId), eq(projectVersions.projectId, project.id))
        )
        .limit(1);
      if (!targetVersion) {
        return NextResponse.json(
          { error: 'Target version not found in this project' },
          { status: 400 }
        );
      }
    }

    const releasedAt = new Date();

    const { updated, movedIssueIds } = await db.transaction(async (tx) => {
      let movedIssueIds: string[] = [];
      if (targetVersionId) {
        // Unresolved issues still pointing at this version
        const openRows = await tx
          .select({ issueId: issueFixVersions.issueId })
          .from(issueFixVersions)
          .innerJoin(issues, eq(issueFixVersions.issueId, issues.id))
          .where(and(eq(issueFixVersions.versionId, version.id), isNull(issues.resolution)));
        movedIssueIds = openRows.map((row) => row.issueId);

        if (movedIssueIds.length > 0) {
          await tx
            .delete(issueFixVersions)
            .where(
              and(
                eq(issueFixVersions.versionId, version.id),
                inArray(issueFixVersions.issueId, movedIssueIds)
              )
            );
          await tx
            .insert(issueFixVersions)
            .values(
              movedIssueIds.map((issueId) => ({
                issueId,
                versionId: targetVersionId,
                organizationId: project.organizationId,
              }))
            )
            .onConflictDoNothing();
        }
      }

      const rows = await tx
        .update(projectVersions)
        .set({ status: 'released', releasedAt, updatedAt: releasedAt })
        .where(eq(projectVersions.id, version.id))
        .returning();
      return { updated: rows[0], movedIssueIds };
    });

    return NextResponse.json({ version: updated, movedIssueCount: movedIssueIds.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error releasing project version:', error);
    return NextResponse.json({ error: 'Failed to release version' }, { status: 500 });
  }
}
