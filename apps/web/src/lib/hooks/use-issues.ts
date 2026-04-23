'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Issue {
  id: string;
  key: string;
  number?: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  priority: string;
  assigneeId: string | null;
  reporterId: string;
  organizationId: string;
  projectId: string;
  sprintId: string | null;
  estimate: number | null;
  labels?: string[];
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  reporter?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

interface IssuesResponse {
  issues: Issue[];
}

interface IssueFilters {
  projectId?: string;
  assigneeId?: string;
  status?: string;
  sprintId?: string;
  type?: string;
}

// Fetch issues with filters
export function useIssues(filters?: IssueFilters) {
  return useQuery({
    queryKey: ['issues', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.projectId) params.append('projectId', filters.projectId);
      if (filters?.assigneeId) params.append('assigneeId', filters.assigneeId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.sprintId) params.append('sprintId', filters.sprintId);
      if (filters?.type) params.append('type', filters.type);

      const response = await fetch(`/api/issues?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch issues');
      }
      const data: IssuesResponse = await response.json();
      return data.issues;
    },
  });
}

// Fetch single issue
export function useIssue(issueId: string | null) {
  return useQuery({
    queryKey: ['issue', issueId],
    queryFn: async (): Promise<Issue | null> => {
      if (!issueId) throw new Error('Issue ID is required');
      const response = await fetch(`/api/issues/${issueId}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch issue');
      }
      const data = await response.json();
      return data as Issue;
    },
    enabled: !!issueId,
  });
}

// Create issue mutation
export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Issue> & { parentId?: string }) => {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', error);
        throw new Error(error.error || 'Failed to create issue');
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Scope invalidation to the affected project when possible
      const createdProjectId =
        (data as Issue | undefined)?.projectId || variables.projectId;
      if (createdProjectId) {
        queryClient.invalidateQueries({
          queryKey: ['issues'],
          predicate: (query) => {
            const filters = query.queryKey[1] as { projectId?: string } | undefined;
            return filters?.projectId === createdProjectId;
          },
        });
        // Keep column counts fresh
        queryClient.invalidateQueries({ queryKey: ['workflow-statuses', createdProjectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['issues'] });
        queryClient.invalidateQueries({ queryKey: ['workflow-statuses'] });
      }
      // Also invalidate subtasks if this was a subtask
      if (variables.parentId) {
        queryClient.invalidateQueries({ queryKey: ['subtasks', variables.parentId] });
      }
      // Dashboard/home widgets derived from the same data must reflect new work.
      queryClient.invalidateQueries({ queryKey: ['my-issues'] });
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
    },
  });
}

// Update issue mutation
export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ issueId, data }: { issueId: string; data: Partial<Issue> }) => {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to update issue');
      }
      return response.json();
    },

    // Optimistic update
    onMutate: async ({ issueId, data }) => {
      // Cancel any outgoing refetches that would overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['issues'] });
      await queryClient.cancelQueries({ queryKey: ['issue', issueId] });

      // Snapshot all ['issues', ...] queries currently cached
      const prevListsEntries = queryClient.getQueriesData<Issue[]>({ queryKey: ['issues'] });
      const prevIssue = queryClient.getQueryData<Issue>(['issue', issueId]);

      // Apply the patch optimistically across ALL matching list caches
      queryClient.setQueriesData<Issue[]>({ queryKey: ['issues'] }, (oldList) => {
        if (!oldList) return oldList;
        return oldList.map((i) => (i.id === issueId ? { ...i, ...data } : i));
      });

      if (prevIssue) {
        queryClient.setQueryData<Issue>(['issue', issueId], { ...prevIssue, ...data });
      }

      return { prevListsEntries, prevIssue };
    },

    onError: (_err, { issueId }, context) => {
      // Rollback
      if (context?.prevListsEntries) {
        for (const [key, data] of context.prevListsEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.prevIssue) {
        queryClient.setQueryData(['issue', issueId], context.prevIssue);
      }
    },

    onSuccess: (data) => {
      const updated = data as Issue | undefined;
      if (updated?.id) {
        queryClient.setQueryData(['issue', updated.id], updated);
      }
    },

    onSettled: (_data, _error, { issueId }) => {
      // Always refetch after mutation resolves to ensure server truth
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue', issueId] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['sprint-issues'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-statuses'] });
      // Dashboard/home widgets rely on these keys for live-looking data.
      queryClient.invalidateQueries({ queryKey: ['my-issues'] });
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
    },
  });
}

// Delete issue mutation
export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueId: string) => {
      // Capture projectId from cache before deletion so we can scope invalidation
      const cached = queryClient.getQueryData<Issue>(['issue', issueId]);
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete issue');
      }
      return { ...(await response.json()), projectId: cached?.projectId };
    },
    onSuccess: (data: { projectId?: string }) => {
      const projectId = data?.projectId;
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: ['issues'],
          predicate: (query) => {
            const filters = query.queryKey[1] as { projectId?: string } | undefined;
            return filters?.projectId === projectId;
          },
        });
        queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['issues'] });
        queryClient.invalidateQueries({ queryKey: ['sprints'] });
      }
      queryClient.invalidateQueries({ queryKey: ['sprint-issues'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      // Keep dashboard/home widgets in sync after removals too.
      queryClient.invalidateQueries({ queryKey: ['my-issues'] });
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
      queryClient.invalidateQueries({ queryKey: ['recent-activities'] });
    },
  });
}
