import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import {
  getCommentById,
  updateComment,
  deleteComment,
  hasCommentReplies,
  getProjectById,
  createAuditLog,
  type issueComments,
} from '@tasknebula/db';
import { auth } from '@/auth';
import { publishEvent } from '@/lib/realtime/events';
import { withValidation } from '@/lib/api-validation';
import { canCommentOnIssue, canReadIssue, canManageProject } from '@/lib/auth/access-control';

// Edit accepts content and/or mentions — at least one must be present.
const updateCommentSchema = z
  .object({
    content: z.string().min(1).optional(),
    mentions: z.array(z.string()).optional(),
  })
  .refine((data) => data.content !== undefined || data.mentions !== undefined, {
    message: 'At least one of content or mentions is required',
  });

const commentParamsSchema = z.object({
  issueId: z.string().min(1),
  commentId: z.string().min(1),
});

type CommentRow = typeof issueComments.$inferSelect;

/**
 * Author-or-project-admin check shared by PATCH and DELETE.
 * The project is loaded from the issue row (never from the request),
 * keeping the check org-scoped.
 */
async function canModifyComment(
  userId: string,
  comment: CommentRow,
  projectId: string
): Promise<boolean> {
  if (comment.createdBy === userId) return true;
  const project = await getProjectById(projectId);
  if (!project) return false;
  return canManageProject(userId, project);
}

/** The "edited" flag derives from updatedAt > createdAt (no editedAt column). */
function withEditedFlag(comment: CommentRow) {
  return {
    ...comment,
    edited: new Date(comment.updatedAt).getTime() > new Date(comment.createdAt).getTime(),
  };
}

// PATCH /api/issues/[issueId]/comments/[commentId] - Edit a comment
export const PATCH = withValidation({
  body: updateCommentSchema,
  params: commentParamsSchema,
})(async (request, { body, params }) => {
  const { issueId, commentId } = params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id!;

    const access = await canCommentOnIssue(userId, issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const comment = await getCommentById(commentId);
    // Cross-issue / cross-org probing gets a 404, never a hint the id exists.
    if (!comment || comment.issueId !== issueId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (!(await canModifyComment(userId, comment, access.issue.projectId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: { content?: string; mentions?: string[]; updatedBy: string } = {
      updatedBy: userId,
    };
    if (body.content !== undefined) updateData.content = body.content;
    if (body.mentions !== undefined) updateData.mentions = body.mentions;

    const updated = await updateComment(commentId, updateData);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
    }

    const issue = access.issue;
    after(async () => {
      try {
        await createAuditLog({
          userId,
          organizationId: issue.organizationId,
          action: 'issue.commented',
          resourceType: 'issue_comment',
          resourceId: commentId,
          projectId: issue.projectId,
          issueId,
          metadata: { commentId, operation: 'comment_updated' },
        });
      } catch (err) {
        console.error('audit log failed', err);
      }

      try {
        publishEvent('issue.commented', userId, {
          issueId,
          projectId: issue.projectId,
          organizationId: issue.organizationId,
        });
      } catch (err) {
        console.error('publishEvent failed', err);
      }
    });

    return NextResponse.json(withEditedFlag(updated));
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
});

// DELETE /api/issues/[issueId]/comments/[commentId] - Delete a comment
//
// Comments with threaded replies cannot be deleted (409): the schema has no
// deletedAt/tombstone column and parent_id is ON DELETE CASCADE, so a hard
// delete would silently destroy the whole thread. Blocking is the only
// semantics the current schema represents faithfully.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string; commentId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id!;

    const { issueId, commentId } = await params;

    // Base visibility uses read access (an author whose comment permission
    // was later revoked can still remove their own comment).
    const access = await canReadIssue(userId, issueId);
    if (!access.issue) {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const comment = await getCommentById(commentId);
    if (!comment || comment.issueId !== issueId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    if (!(await canModifyComment(userId, comment, access.issue.projectId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (await hasCommentReplies(commentId)) {
      return NextResponse.json(
        { error: 'Cannot delete a comment that has replies' },
        { status: 409 }
      );
    }

    const deleted = await deleteComment(commentId);
    if (!deleted) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const issue = access.issue;
    after(async () => {
      try {
        await createAuditLog({
          userId,
          organizationId: issue.organizationId,
          action: 'issue.commented',
          resourceType: 'issue_comment',
          resourceId: commentId,
          projectId: issue.projectId,
          issueId,
          metadata: { commentId, operation: 'comment_deleted' },
        });
      } catch (err) {
        console.error('audit log failed', err);
      }

      try {
        publishEvent('issue.commented', userId, {
          issueId,
          projectId: issue.projectId,
          organizationId: issue.organizationId,
        });
      } catch (err) {
        console.error('publishEvent failed', err);
      }
    });

    return NextResponse.json({ success: true, id: commentId });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
