import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface CommentReaction {
  emoji: string;
  userId: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  parentId?: string | null;
  content: string;
  mentions?: string[];
  reactions?: CommentReaction[];
  isInternal?: string;
  createdBy?: string;
  author: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
  createdAt: string | Date;
  updatedAt?: string | Date;
}

interface CommentsResponse {
  comments: Comment[];
}

/** Sentinel error message for a DELETE rejected because the comment has replies (HTTP 409). */
export const COMMENT_HAS_REPLIES_ERROR = 'COMMENT_HAS_REPLIES';

type CreateCommentInput = string | { content: string; mentions?: string[] };

interface UpdateCommentInput {
  commentId: string;
  content: string;
  mentions?: string[];
}

interface ToggleCommentReactionInput {
  commentId: string;
  emoji: string;
  /** Session user id — only used locally for the optimistic cache toggle, never sent to the server. */
  userId: string;
}

interface ToggleCommentReactionResponse {
  commentId: string;
  reacted: boolean;
  reactions: CommentReaction[];
}

export function useComments(issueId: string) {
  return useQuery({
    queryKey: ['comments', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/issues/${issueId}/comments`);
      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }
      const data: CommentsResponse = await response.json();
      return data.comments;
    },
    refetchInterval: 10000, // Poll every 10 seconds for new comments
  });
}

export function useCreateComment(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const { content, mentions } =
        typeof input === 'string' ? { content: input, mentions: undefined } : input;
      const payload: { content: string; mentions?: string[] } =
        mentions && mentions.length > 0 ? { content, mentions } : { content };

      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create comment');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate comments query to refetch
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
    },
  });
}

export function useUpdateComment(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, content, mentions }: UpdateCommentInput) => {
      const payload: { content: string; mentions?: string[] } =
        mentions && mentions.length > 0 ? { content, mentions } : { content };

      const response = await fetch(`/api/issues/${issueId}/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update comment');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
    },
  });
}

export function useDeleteComment(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(`/api/issues/${issueId}/comments/${commentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(
          response.status === 409 ? COMMENT_HAS_REPLIES_ERROR : 'Failed to delete comment'
        );
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
    },
  });
}

export function useToggleCommentReaction(issueId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, emoji }: ToggleCommentReactionInput) => {
      const response = await fetch(`/api/issues/${issueId}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle reaction');
      }

      return response.json() as Promise<ToggleCommentReactionResponse>;
    },
    onMutate: async ({ commentId, emoji, userId }) => {
      await queryClient.cancelQueries({ queryKey: ['comments', issueId] });
      const previous = queryClient.getQueryData<Comment[]>(['comments', issueId]);

      queryClient.setQueryData<Comment[]>(['comments', issueId], (old) =>
        old?.map((comment) => {
          if (comment.id !== commentId) return comment;
          const reactions = comment.reactions ?? [];
          const mine = (reaction: CommentReaction) =>
            reaction.emoji === emoji && reaction.userId === userId;
          return {
            ...comment,
            reactions: reactions.some(mine)
              ? reactions.filter((reaction) => !mine(reaction))
              : [...reactions, { emoji, userId, createdAt: new Date().toISOString() }],
          };
        })
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['comments', issueId], context.previous);
      }
    },
    onSuccess: (data) => {
      // Write the server's authoritative reactions for the toggled comment.
      queryClient.setQueryData<Comment[]>(['comments', issueId], (old) =>
        old?.map((comment) =>
          comment.id === data.commentId ? { ...comment, reactions: data.reactions } : comment
        )
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', issueId] });
    },
  });
}
