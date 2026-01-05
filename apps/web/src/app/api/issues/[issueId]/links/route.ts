import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, issueLinks, issues } from '@tasknebula/db';
import { eq, or, and } from 'drizzle-orm';
import { z } from 'zod';

const createLinkSchema = z.object({
  targetIssueId: z.string(),
  type: z.enum(['blocks', 'blocked_by', 'relates_to', 'duplicates', 'duplicated_by', 'parent_of', 'child_of']),
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
    // Fetch outbound links (where this issue is the source)
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
      .where(eq(issueLinks.sourceIssueId, issueId));

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
      .where(eq(issueLinks.targetIssueId, issueId));

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
    const body = await request.json();
    const { targetIssueId, type } = createLinkSchema.parse(body);

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
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
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

  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get('linkId');

  if (!linkId) {
    return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
  }

  try {
    await db.delete(issueLinks).where(eq(issueLinks.id, linkId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting issue link:', error);
    return NextResponse.json({ error: 'Failed to delete issue link' }, { status: 500 });
  }
}

