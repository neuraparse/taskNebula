import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  db,
  projectVersions,
  issueFixVersions,
  issueAffectsVersions,
  createActivity,
} from '@tasknebula/db';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { publishEvent } from '@/lib/realtime/events';
import { canEditIssue, canReadIssue, isActiveOrganizationMember } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const setVersionsSchema = z
  .object({
    fixVersionIds: z.array(z.string()).optional(),
    affectsVersionIds: z.array(z.string()).optional(),
  })
  .refine((body) => body.fixVersionIds !== undefined || body.affectsVersionIds !== undefined, {
    message: 'Provide fixVersionIds and/or affectsVersionIds',
  });

async function getIssueVersions(issueId: string) {
  const fixRows = await db
    .select({ version: projectVersions })
    .from(issueFixVersions)
    .innerJoin(projectVersions, eq(issueFixVersions.versionId, projectVersions.id))
    .where(eq(issueFixVersions.issueId, issueId))
    .orderBy(asc(projectVersions.sortOrder), asc(projectVersions.name));

  const affectsRows = await db
    .select({ version: projectVersions })
    .from(issueAffectsVersions)
    .innerJoin(projectVersions, eq(issueAffectsVersions.versionId, projectVersions.id))
    .where(eq(issueAffectsVersions.issueId, issueId))
    .orderBy(asc(projectVersions.sortOrder), asc(projectVersions.name));

  return {
    fixVersions: fixRows.map((row) => row.version),
    affectsVersions: affectsRows.map((row) => row.version),
  };
}

// GET /api/issues/[issueId]/versions - Fix + affects versions for an issue
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;

  try {
    // Cross-org probes get a 404 so we don't leak that the issue exists.
    const access = await canReadIssue(session.user.id, issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      const sameOrg = await isActiveOrganizationMember(
        session.user.id,
        access.issue.organizationId
      );
      return NextResponse.json(
        { error: sameOrg ? 'Forbidden' : 'Issue not found' },
        { status: sameOrg ? 403 : 404 }
      );
    }

    return NextResponse.json(await getIssueVersions(access.issue.id));
  } catch (error) {
    console.error('Error fetching issue versions:', error);
    return NextResponse.json({ error: 'Failed to fetch issue versions' }, { status: 500 });
  }
}

// PUT /api/issues/[issueId]/versions - Replace fix and/or affects versions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;

  try {
    const access = await canEditIssue(session.user.id, issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      const sameOrg = await isActiveOrganizationMember(
        session.user.id,
        access.issue.organizationId
      );
      return NextResponse.json(
        { error: sameOrg ? 'Forbidden' : 'Issue not found' },
        { status: sameOrg ? 403 : 404 }
      );
    }
    const issue = access.issue;

    const body = setVersionsSchema.parse(await request.json());
    const fixVersionIds =
      body.fixVersionIds !== undefined ? [...new Set(body.fixVersionIds)] : undefined;
    const affectsVersionIds =
      body.affectsVersionIds !== undefined ? [...new Set(body.affectsVersionIds)] : undefined;

    // Every referenced version must belong to the issue's project
    const allIds = [...new Set([...(fixVersionIds ?? []), ...(affectsVersionIds ?? [])])];
    if (allIds.length > 0) {
      const validVersions = await db
        .select({ id: projectVersions.id })
        .from(projectVersions)
        .where(
          and(inArray(projectVersions.id, allIds), eq(projectVersions.projectId, issue.projectId))
        );
      const validIds = new Set(validVersions.map((v) => v.id));
      const invalidIds = allIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "Some versions do not belong to this issue's project", invalidIds },
          { status: 400 }
        );
      }
    }

    await db.transaction(async (tx) => {
      if (fixVersionIds !== undefined) {
        await tx.delete(issueFixVersions).where(eq(issueFixVersions.issueId, issue.id));
        if (fixVersionIds.length > 0) {
          await tx.insert(issueFixVersions).values(
            fixVersionIds.map((versionId) => ({
              issueId: issue.id,
              versionId,
              organizationId: issue.organizationId,
            }))
          );
        }
      }
      if (affectsVersionIds !== undefined) {
        await tx.delete(issueAffectsVersions).where(eq(issueAffectsVersions.issueId, issue.id));
        if (affectsVersionIds.length > 0) {
          await tx.insert(issueAffectsVersions).values(
            affectsVersionIds.map((versionId) => ({
              issueId: issue.id,
              versionId,
              organizationId: issue.organizationId,
            }))
          );
        }
      }
    });

    try {
      await createActivity({
        issueId: issue.id,
        userId: session.user.id,
        type: 'updated',
        field:
          fixVersionIds !== undefined && affectsVersionIds !== undefined
            ? 'versions'
            : fixVersionIds !== undefined
              ? 'fixVersions'
              : 'affectsVersions',
        metadata: {
          ...(fixVersionIds !== undefined ? { fixVersionIds } : {}),
          ...(affectsVersionIds !== undefined ? { affectsVersionIds } : {}),
        },
      });
    } catch (err) {
      console.error('activity log failed', err);
    }

    publishEvent('issue.updated', session.user.id, {
      issueId: issue.id,
      projectId: issue.projectId,
      organizationId: issue.organizationId,
    });

    return NextResponse.json(await getIssueVersions(issue.id));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating issue versions:', error);
    return NextResponse.json({ error: 'Failed to update issue versions' }, { status: 500 });
  }
}
