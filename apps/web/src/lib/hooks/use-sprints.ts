'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { throwApiResponseError } from '@/lib/client-api-errors';

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
      if (!response.ok) await throwApiResponseError(response, 'Failed to fetch sprints');
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
      if (!response.ok) await throwApiResponseError(response, 'Failed to fetch sprint');
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
      if (!response.ok) await throwApiResponseError(response, 'Failed to fetch sprint issues');
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
        await throwApiResponseError(response, 'Failed to create sprint');
      }
      return response.json() as Promise<Sprint>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', variables.projectId] });
    },
  });
}

/**
 * Inline "type-to-create" mutation for the Sprint picker (Jira/Plane style),
 * mirroring `useCreateProjectComponent`. Callers pass only `projectId + name`;
 * the API requires start/end dates, so we default a sensible two-week window
 * (today → +14 days). Thrown errors carry the HTTP `status` via
 * `Object.assign` so the picker can branch on 403 (no permission) /
 * 409 (duplicate) like the other inline-create pickers.
 */
export function useInlineCreateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      name,
    }: {
      projectId: string;
      name: string;
    }): Promise<Sprint> => {
      const start = new Date();
      const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
      const response = await fetch('/api/sprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      });
      if (!response.ok) {
        await throwApiResponseError(response, 'Failed to create sprint');
      }
      return response.json() as Promise<Sprint>;
    },
    onSuccess: (created, { projectId }) => {
      // Seed the list cache so the new option renders before the refetch lands.
      queryClient.setQueryData<Sprint[]>(['sprints', projectId], (old) =>
        old ? [...old, { ...created, issueCount: 0 }] : old
      );
    },
    onSettled: (_data, _error, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });
}

// Update sprint
export function useUpdateSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sprintId, data }: { sprintId: string; data: Partial<Sprint> }) => {
      const response = await fetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await throwApiResponseError(response, 'Failed to update sprint');
      }
      return response.json() as Promise<Sprint>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sprint', data.id] });
      queryClient.invalidateQueries({ queryKey: ['sprints', data.projectId] });
      queryClient.invalidateQueries({ queryKey: ['sprint-issues'] });
      if (data.projectId) {
        queryClient.invalidateQueries({
          queryKey: ['issues'],
          predicate: (query) => {
            const filters = query.queryKey[1] as { projectId?: string } | undefined;
            return filters?.projectId === data.projectId;
          },
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['issues'] });
      }
    },
  });
}

// Delete sprint
export function useDeleteSprint() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sprintId: string) => {
      // Capture projectId from cache before deletion so we can scope invalidation
      const cached = queryClient.getQueryData<Sprint>(['sprint', sprintId]);
      const response = await fetch(`/api/sprints/${sprintId}`, {
        method: 'DELETE',
      });
      if (!response.ok) await throwApiResponseError(response, 'Failed to delete sprint');
      const json = await response.json();
      return { ...json, projectId: cached?.projectId };
    },
    onSuccess: (data: { projectId?: string }) => {
      const projectId = data?.projectId;
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
        queryClient.invalidateQueries({
          queryKey: ['issues'],
          predicate: (query) => {
            const filters = query.queryKey[1] as { projectId?: string } | undefined;
            return filters?.projectId === projectId;
          },
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['sprints'] });
        queryClient.invalidateQueries({ queryKey: ['issues'] });
      }
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
