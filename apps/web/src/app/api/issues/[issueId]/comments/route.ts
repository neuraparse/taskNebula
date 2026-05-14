import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIssueComments, createComment, createActivity, createAuditLog, getIssueById } from '@tasknebula/db';
import { auth } from '@/auth';
import { createId } from '@paralleldrive/cuid2';
import { notifyIssueEvent } from '@/lib/notifications/send-notification';
import { publishEvent } from '@/lib/realtime/events';
import { withValidation } from '@/lib/api-validation';

// Validation schema for creating a comment
const createCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).default([]),
  isInternal: z.boolean().default(false),
});

const commentsParamsSchema = z.object({ issueId: z.string().min(1) });

// GET /api/issues/[issueId]/comments - Get all comments for an issue
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;
    const comments = await getIssueComments(issueId);

    return NextResponse.json({
      comments,
      total: comments.length,
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 });
  }
}

// POST /api/issues/[issueId]/comments - Create a new comment
// Migrated to withValidation (FEAT-29). Body + params are parsed by the
// wrapper; ZodError handling is no longer needed in the handler.
export const POST = withValidation({
  body: createCommentSchema,
  params: commentsParamsSchema,
})(async (request, { body: validatedData, params }) => {
  const { issueId } = params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const newComment = await createComment({
      id: createId(),
      issueId,
      content: validatedData.content,
      parentId: validatedData.parentId || null,
      mentions: validatedData.mentions,
      reactions: [],
      isInternal: validatedData.isInternal ? 'true' : 'false',
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    // Create activity log for comment
    await createActivity({
      issueId,
      userId: session.user.id,
      type: 'commented',
      metadata: { commentId: newComment.id },
    });

    // Get issue details for audit log and notifications
    const issue = await getIssueById(issueId);
    if (issue) {
      await createAuditLog({
        userId: session.user.id,
        organizationId: issue.organizationId,
        action: 'issue.commented',
        resourceType: 'issue',
        resourceId: issueId,
        projectId: issue.projectId,
        issueId,
        metadata: { commentId: newComment.id },
      });

      publishEvent('issue.commented', session.user.id, {
        issueId,
        projectId: issue.projectId,
        organizationId: issue.organizationId,
      });

      // Notify assignee about new comment
      if (issue.assigneeId) {
        notifyIssueEvent({
          eventType: 'issue_commented',
          recipientUserId: issue.assigneeId,
          actorUserId: session.user.id!,
          organizationId: issue.organizationId,
          issueKey: issue.key,
          issueTitle: issue.title,
          projectName: issue.key?.split('-')[0] || '',
          extra: { commentBody: validatedData.content.substring(0, 200) },
        });
      }

      // Notify reporter about new comment (if different from assignee)
      if (issue.reporterId && issue.reporterId !== issue.assigneeId) {
        notifyIssueEvent({
          eventType: 'issue_commented',
          recipientUserId: issue.reporterId,
          actorUserId: session.user.id!,
          organizationId: issue.organizationId,
          issueKey: issue.key,
          issueTitle: issue.title,
          projectName: issue.key?.split('-')[0] || '',
          extra: { commentBody: validatedData.content.substring(0, 200) },
        });
      }
    }

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
});

