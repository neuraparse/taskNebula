import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import {
  getIssueComments,
  createComment,
  createActivity,
  createAuditLog,
  getIssueById,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { createId } from '@paralleldrive/cuid2';
import { notifyIssueEvent } from '@/lib/notifications/send-notification';
import { publishEvent } from '@/lib/realtime/events';
import { withValidation } from '@/lib/api-validation';
import { canCommentOnIssue, canReadIssue } from '@/lib/auth/access-control';
import {
  guardAgentAction,
  readAgentPolicyMarker,
  stripAgentPolicyMarker,
} from '@/lib/agent-policy/guard';

// Validation schema for creating a comment
const createCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
  mentions: z.array(z.string()).default([]),
  isInternal: z.boolean().default(false),
  agentPolicy: z
    .object({
      actor: z.string().min(1).max(120),
      source: z.string().max(120).optional(),
      resource: z.string().max(80).optional(),
      action: z.string().max(80).optional(),
      targetType: z.string().max(80).optional(),
    })
    .optional(),
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
    const access = await canReadIssue(session.user.id!, issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const access = await canCommentOnIssue(session.user.id!, issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const agentPolicy = readAgentPolicyMarker(validatedData.agentPolicy);
    const commentInput = stripAgentPolicyMarker(validatedData);
    if (agentPolicy) {
      const guard = await guardAgentAction({
        workspaceId: access.issue.organizationId,
        projectId: access.issue.projectId,
        requestedBy: session.user.id!,
        actor: agentPolicy.actor,
        resource: agentPolicy.resource || 'issues',
        action: agentPolicy.action || 'comment',
        targetType: agentPolicy.targetType || 'issue',
        targetId: issueId,
        proposedPayload: {
          executor: 'comments:create',
          data: {
            issueId,
            data: commentInput,
          },
        },
        context: {
          source: agentPolicy.source,
          issueKey: access.issue.key,
        },
      });
      if (!guard.allowed) {
        return NextResponse.json(guard.body, { status: guard.httpStatus });
      }
    }

    const newComment = await createComment({
      id: createId(),
      issueId,
      content: commentInput.content,
      parentId: commentInput.parentId || null,
      mentions: commentInput.mentions,
      reactions: [],
      isInternal: commentInput.isInternal ? 'true' : 'false',
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });

    if (!newComment) {
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
    }

    // Defer activity log, audit log, realtime publish, and notification
    // emails until after the response ships. The caller only needs the
    // newly-created comment payload to render optimistically.
    const actorUserId = session.user.id!;
    const commentSnippet = commentInput.content.substring(0, 200);
    after(async () => {
      try {
        await createActivity({
          issueId,
          userId: actorUserId,
          type: 'commented',
          metadata: { commentId: newComment.id },
        });
      } catch (err) {
        console.error('activity log failed', err);
      }

      const issue = await getIssueById(issueId).catch(() => null);
      if (!issue) return;

      try {
        await createAuditLog({
          userId: actorUserId,
          organizationId: issue.organizationId,
          action: 'issue.commented',
          resourceType: 'issue',
          resourceId: issueId,
          projectId: issue.projectId,
          issueId,
          metadata: { commentId: newComment.id },
        });
      } catch (err) {
        console.error('audit log failed', err);
      }

      try {
        publishEvent('issue.commented', actorUserId, {
          issueId,
          projectId: issue.projectId,
          organizationId: issue.organizationId,
        });
      } catch (err) {
        console.error('publishEvent failed', err);
      }

      const projectName = issue.key?.split('-')[0] || '';

      if (issue.assigneeId) {
        try {
          await notifyIssueEvent({
            eventType: 'issue_commented',
            recipientUserId: issue.assigneeId,
            actorUserId,
            organizationId: issue.organizationId,
            issueId,
            projectId: issue.projectId,
            issueKey: issue.key,
            issueTitle: issue.title,
            projectName,
            extra: { commentBody: commentSnippet },
          });
        } catch (err) {
          console.error('comment notify (assignee) failed', err);
        }
      }

      if (issue.reporterId && issue.reporterId !== issue.assigneeId) {
        try {
          await notifyIssueEvent({
            eventType: 'issue_commented',
            recipientUserId: issue.reporterId,
            actorUserId,
            organizationId: issue.organizationId,
            issueId,
            projectId: issue.projectId,
            issueKey: issue.key,
            issueTitle: issue.title,
            projectName,
            extra: { commentBody: commentSnippet },
          });
        } catch (err) {
          console.error('comment notify (reporter) failed', err);
        }
      }
    });

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
});
