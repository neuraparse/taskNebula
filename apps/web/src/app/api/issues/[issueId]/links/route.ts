import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueLinks, issues } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { canEditIssue, canReadIssue, isActiveOrganizationMember } from '@/lib/auth/access-control';

const createLinkSchema = z.object({
  targetIssueId: z.string(),
  type: z.enum([
    'blocks',
    'blocked_by',
    'relates_to',
    'duplicates',
    'duplicated_by',
    'parent_of',
    'child_of',
  ]),
});

// GET /api/issues/[issueId]/links - Fetch all links for an issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;

  try {
    // Permission check: caller must be able to read the subject issue.
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

    // Fetch outbound links (where this issue is the source). Linked issues
    // are scoped to the subject issue's organization so legacy cross-org
    // rows never leak another tenant's data.
    const outboundLinksData = await db
      .select({
        id: issueLinks.id,
        type: issueLinks.type,
        createdAt: issueLinks.createdAt,
        targetIssue: {
          id: issues.id,
          key: issues.key,
          title: issues.title,
          statusId: issues.statusId,
          type: issues.type,
          priority: issues.priority,
        },
      })
      .from(issueLinks)
      .innerJoin(issues, eq(issueLinks.targetIssueId, issues.id))
      .where(
        and(
          eq(issueLinks.sourceIssueId, issueId),
          eq(issues.organizationId, access.issue.organizationId)
        )
      );

    // Fetch inbound links (where this issue is the target)
    const inboundLinksData = await db
      .select({
        id: issueLinks.id,
        type: issueLinks.type,
        createdAt: issueLinks.createdAt,
        sourceIssue: {
          id: issues.id,
          key: issues.key,
          title: issues.title,
          statusId: issues.statusId,
          type: issues.type,
          priority: issues.priority,
        },
      })
      .from(issueLinks)
      .innerJoin(issues, eq(issueLinks.sourceIssueId, issues.id))
      .where(
        and(
          eq(issueLinks.targetIssueId, issueId),
          eq(issues.organizationId, access.issue.organizationId)
        )
      );

    const outboundLinks = outboundLinksData.map((link) => ({
      id: link.id,
      type: link.type,
      issue: link.targetIssue,
      direction: 'outbound' as const,
      createdAt: link.createdAt,
    }));

    const inboundLinks = inboundLinksData.map((link) => ({
      id: link.id,
      type: link.type,
      issue: link.sourceIssue,
      direction: 'inbound' as const,
      createdAt: link.createdAt,
    }));

    return NextResponse.json({
      outbound: outboundLinks,
      inbound: inboundLinks,
    });
  } catch (error) {
    console.error('Error fetching issue links:', error);
    return NextResponse.json({ error: 'Failed to fetch issue links' }, { status: 500 });
  }
}

// POST /api/issues/[issueId]/links - Create a new link
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;

  try {
    // Permission check: caller needs edit-level access on the subject issue.
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

    const body = await request.json();
    const { targetIssueId, type } = createLinkSchema.parse(body);

    // The target issue must be readable by the caller and live in the same
    // organization as the subject issue; otherwise report it as not found so
    // cross-org ids can't be probed or linked.
    const target = await canReadIssue(session.user.id, targetIssueId);
    if (
      !target.issue ||
      !target.allowed ||
      target.issue.organizationId !== access.issue.organizationId
    ) {
      return NextResponse.json({ error: 'Target issue not found' }, { status: 404 });
    }

    // Check if link already exists
    const [existingLink] = await db
      .select()
      .from(issueLinks)
      .where(
        and(
          eq(issueLinks.sourceIssueId, issueId),
          eq(issueLinks.targetIssueId, targetIssueId),
          eq(issueLinks.type, type)
        )
      );

    if (existingLink) {
      return NextResponse.json({ error: 'Link already exists' }, { status: 400 });
    }

    // Create the link
    const [newLink] = await db
      .insert(issueLinks)
      .values({
        sourceIssueId: issueId,
        targetIssueId,
        type,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      })
      .returning();

    return NextResponse.json(newLink, { status: 201 });
  } catch (error) {
    console.error('Error creating issue link:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Failed to create issue link' }, { status: 500 });
  }
}

// DELETE /api/issues/[issueId]/links?linkId=xxx - Delete a link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issueId } = await params;
  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get('linkId');

  if (!linkId) {
    return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
  }

  try {
    // Permission check: caller needs edit-level access on the subject issue.
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

    // The link row must actually belong to the subject issue (as source or
    // target) — otherwise arbitrary link ids from other issues/orgs could be
    // deleted through this endpoint.
    const [link] = await db.select().from(issueLinks).where(eq(issueLinks.id, linkId)).limit(1);

    if (!link || (link.sourceIssueId !== issueId && link.targetIssueId !== issueId)) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // The issue on the other end must be visible within the same organization.
    const otherIssueId = link.sourceIssueId === issueId ? link.targetIssueId : link.sourceIssueId;
    const [otherIssue] = await db
      .select({ organizationId: issues.organizationId })
      .from(issues)
      .where(eq(issues.id, otherIssueId))
      .limit(1);

    if (!otherIssue || otherIssue.organizationId !== access.issue.organizationId) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    await db.delete(issueLinks).where(eq(issueLinks.id, linkId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting issue link:', error);
    return NextResponse.json({ error: 'Failed to delete issue link' }, { status: 500 });
  }
}
