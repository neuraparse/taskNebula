import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, components, issueComponents, createActivity } from '@tasknebula/db';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { publishEvent } from '@/lib/realtime/events';
import { canEditIssue, canReadIssue, isActiveOrganizationMember } from '@/lib/auth/access-control';

export const dynamic = 'force-dynamic';

const setComponentsSchema = z.object({
  componentIds: z.array(z.string()),
});

async function getIssueComponents(issueId: string) {
  const rows = await db
    .select({ component: components })
    .from(issueComponents)
    .innerJoin(components, eq(issueComponents.componentId, components.id))
    .where(eq(issueComponents.issueId, issueId))
    .orderBy(asc(components.name));

  return rows.map((row) => row.component);
}

// GET /api/issues/[issueId]/components - Components linked to an issue
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

    return NextResponse.json({ components: await getIssueComponents(access.issue.id) });
  } catch (error) {
    console.error('Error fetching issue components:', error);
    return NextResponse.json({ error: 'Failed to fetch issue components' }, { status: 500 });
  }
}

// PUT /api/issues/[issueId]/components - Replace the issue's components
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

    const body = setComponentsSchema.parse(await request.json());
    const componentIds = [...new Set(body.componentIds)];

    // Every referenced component must belong to the issue's project
    if (componentIds.length > 0) {
      const validComponents = await db
        .select({ id: components.id })
        .from(components)
        .where(
          and(inArray(components.id, componentIds), eq(components.projectId, issue.projectId))
        );
      const validIds = new Set(validComponents.map((c) => c.id));
      const invalidIds = componentIds.filter((id) => !validIds.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          { error: "Some components do not belong to this issue's project", invalidIds },
          { status: 400 }
        );
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(issueComponents).where(eq(issueComponents.issueId, issue.id));
      if (componentIds.length > 0) {
        await tx.insert(issueComponents).values(
          componentIds.map((componentId) => ({
            issueId: issue.id,
            componentId,
            organizationId: issue.organizationId,
          }))
        );
      }
    });

    try {
      await createActivity({
        issueId: issue.id,
        userId: session.user.id,
        type: 'updated',
        field: 'components',
        metadata: { componentIds },
      });
    } catch (err) {
      console.error('activity log failed', err);
    }

    publishEvent('issue.updated', session.user.id, {
      issueId: issue.id,
      projectId: issue.projectId,
      organizationId: issue.organizationId,
    });

    return NextResponse.json({ components: await getIssueComponents(issue.id) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating issue components:', error);
    return NextResponse.json({ error: 'Failed to update issue components' }, { status: 500 });
  }
}
