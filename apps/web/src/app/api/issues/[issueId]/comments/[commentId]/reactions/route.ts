import { NextResponse, after } from 'next/server';
import { z } from 'zod';
import { getCommentById, updateCommentReactions } from '@tasknebula/db';
import type { CommentReaction } from '@tasknebula/types';
import { auth } from '@/auth';
import { publishEvent } from '@/lib/realtime/events';
import { withValidation } from '@/lib/api-validation';
import { canCommentOnIssue } from '@/lib/auth/access-control';

// GitHub-style reaction set: thumbsup, thumbsdown, tada, heart, smile,
// confused, rocket, eyes — stored as the literal emoji characters.
// (Module-private: Next.js route files may only export handlers/config.)
const ALLOWED_REACTION_EMOJIS = ['👍', '👎', '🎉', '❤️', '😄', '😕', '🚀', '👀'] as const;

const toggleReactionSchema = z.object({
  emoji: z.enum(ALLOWED_REACTION_EMOJIS),
});

const reactionParamsSchema = z.object({
  issueId: z.string().min(1),
  commentId: z.string().min(1),
});

function parseReactions(value: unknown): CommentReaction[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is CommentReaction =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as CommentReaction).emoji === 'string' &&
      typeof (entry as CommentReaction).userId === 'string'
  );
}

// POST /api/issues/[issueId]/comments/[commentId]/reactions - Toggle a reaction
//
// Toggle semantics (same as chat reactions): if the session user already
// reacted with the emoji it is removed, otherwise it is added. Reactions live
// in the comment's `reactions` JSONB as CommentReaction[] {emoji, userId,
// createdAt} and intentionally do NOT bump updatedAt (which drives the
// "edited" flag).
export const POST = withValidation({
  body: toggleReactionSchema,
  params: reactionParamsSchema,
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

    const current = parseReactions(comment.reactions);
    const existingIndex = current.findIndex(
      (reaction) => reaction.emoji === body.emoji && reaction.userId === userId
    );

    const reacted = existingIndex === -1;
    const next: CommentReaction[] = reacted
      ? [...current, { emoji: body.emoji, userId, createdAt: new Date().toISOString() }]
      : current.filter((_, index) => index !== existingIndex);

    const updated = await updateCommentReactions(commentId, next);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update reactions' }, { status: 500 });
    }

    const issue = access.issue;
    after(async () => {
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

    return NextResponse.json({
      commentId,
      reacted,
      reactions: parseReactions(updated.reactions),
    });
  } catch (error) {
    console.error('Error toggling comment reaction:', error);
    return NextResponse.json({ error: 'Failed to toggle reaction' }, { status: 500 });
  }
});
