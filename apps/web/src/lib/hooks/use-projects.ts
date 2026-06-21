'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { throwApiResponseError } from '@/lib/client-api-errors';

export interface Project {
  id: string;
  organizationId: string;
  teamId?: string | null;
  key: string;
  name: string;
  description: string | null;
  organizationName?: string;
  team?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  visibility?: string;
  status: string;
  settings: Record<string, unknown>;
  defaultWorkflowId?: string | null;
  leadId?: string | null;
  sprintCount?: number;
  issueCount?: number;
  activeSprint?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectsFilters {
  organizationId?: string | null;
  teamId?: string | null;
  enabled?: boolean;
}

// Get all projects
export function useProjects(filters?: ProjectsFilters) {
  return useQuery<Project[]>({
    queryKey: ['projects', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.organizationId) params.append('organizationId', filters.organizationId);
      if (filters?.teamId) params.append('teamId', filters.teamId);

      const response = await fetch(
        `/api/projects${params.size > 0 ? `?${params.toString()}` : ''}`
      );
      if (!response.ok) {
        await throwApiResponseError(response);
      }
      return response.json();
    },
    enabled: filters?.enabled ?? true,
  });
}

// Get single project
export function useProject(projectId: string) {
  return useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        await throwApiResponseError(response);
      }
      return response.json();
    },
    enabled: !!projectId,
  });
}

// Create project
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      key: string;
      description?: string;
      organizationId?: string | null;
      teamId?: string | null;
    }) => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await throwApiResponseError(response);
      }
      return response.json() as Promise<Project>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Update project
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: Partial<Project> }) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await throwApiResponseError(response);
      }
      return response.json() as Promise<Project>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Delete project
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        await throwApiResponseError(response);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}
