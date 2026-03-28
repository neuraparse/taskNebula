'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  issueCount?: number;
}

export interface SprintIssue {
  id: string;
  organizationId: string;
  projectId: string;
  key: string;
  number: number;
  type: string;
  title: string;
  description: string | null;
  statusId: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  reporterId: string;
  labels: string[];
  sprintId: string | null;
  epicId: string | null;
  parentId: string | null;
  estimate: number | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  statusName: string;
  statusColor: string;
}

// Fetch sprints for a project
export function useSprints(projectId: string | null) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const response = await fetch(`/api/sprints?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch sprints');
      return response.json() as Promise<Sprint[]>;
    },
    enabled: !!projectId,
  });
}

// Fetch single sprint
export function useSprint(sprintId: string | null) {
  return useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: async () => {
      if (!sprintId) return null;
      const response = await fetch(`/api/sprints/${sprintId}`);
      if (!response.ok) throw new Error('Failed to fetch sprint');
      return response.json() as Promise<Sprint>;
    },
    enabled: !!sprintId,
  });
}

// Fetch sprint issues
export function useSprintIssues(sprintId: string | null) {
  return useQuery({
    queryKey: ['sprint-issues', sprintId],
    queryFn: async () => {
      if (!sprintId) return [];
      const response = await fetch(`/api/sprints/${sprintId}/issues`);
      if (!response.ok) throw new Error('Failed to fetch sprint issues');
      return response.json() as Promise<SprintIssue[]>;
    },
    enabled: !!sprintId,
  });
}

// Create sprint
export function useCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      name: string;
      goal?: string;
      startDate: Date;
      endDate: Date;
    }) => {
      const response = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create sprint');
      }
      return response.json() as Promise<Sprint>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', variables.projectId] });
    },
  });
}

// Update sprint
export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sprintId,
      data,
    }: {
      sprintId: string;
      data: Partial<Sprint>;
    }) => {
      const response = await fetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update sprint');
      }
      return response.json() as Promise<Sprint>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sprint', data.id] });
      queryClient.invalidateQueries({ queryKey: ['sprints', data.projectId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-issues'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

// Delete sprint
export function useDeleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sprintId: string) => {
      const response = await fetch(`/api/sprints/${sprintId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete sprint');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

// Assign issue to sprint
export function useAssignIssueToSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sprintId, issueId }: { sprintId: string; issueId: string }) => {
      const response = await fetch(`/api/sprints/${sprintId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      });
      if (!response.ok) throw new Error('Failed to assign issue to sprint');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprint-issues', variables.sprintId] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });
}

