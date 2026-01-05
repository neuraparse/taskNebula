import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
  createdAt: string | Date;
}

interface CommentsResponse {
  comments: Comment[];
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
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
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

