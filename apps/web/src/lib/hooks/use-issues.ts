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
    queryFn: async () => {
      if (!issueId) throw new Error('Issue ID is required');
      const response = await fetch(`/api/issues/${issueId}`);
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      // Also invalidate subtasks if this was a subtask
      if (variables.parentId) {
        queryClient.invalidateQueries({ queryKey: ['subtasks', variables.parentId] });
      }
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
        throw new Error('Failed to update issue');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['issue', variables.issueId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-issues'] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
    },
  });
}

// Delete issue mutation
export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueId: string) => {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete issue');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      queryClient.invalidateQueries({ queryKey: ['sprint-issues'] });
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
