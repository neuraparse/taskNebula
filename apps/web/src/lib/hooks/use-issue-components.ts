'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/** components row (project areas of ownership, Jira-parity layer). */
export interface ProjectComponent {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  leadId: string | null;
  defaultAssigneeType: 'project_default' | 'component_lead' | 'unassigned';
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Component + usage count from GET /api/projects/[projectId]/components. */
export interface ProjectComponentWithCount extends ProjectComponent {
  issueCount: number;
}

interface ProjectComponentsResponse {
  components: ProjectComponentWithCount[];
  total: number;
}

interface IssueComponentsResponse {
  components: ProjectComponent[];
}

/** All components of a project (API orders by name). */
export function useProjectComponents(projectId: string | null) {
  return useQuery({
    queryKey: ['project-components', projectId],
    queryFn: async (): Promise<ProjectComponentWithCount[]> => {
      if (!projectId) return [];
      const response = await fetch(`/api/projects/${projectId}/components`);
      if (!response.ok) {
        throw new Error('Failed to fetch project components');
      }
      const data: ProjectComponentsResponse = await response.json();
      return data.components;
    },
    enabled: !!projectId,
  });
}

/** Components linked to an issue. */
export function useIssueComponents(issueId: string | null) {
  return useQuery({
    queryKey: ['issue-components', issueId],
    queryFn: async (): Promise<ProjectComponent[]> => {
      if (!issueId) return [];
      const response = await fetch(`/api/issues/${issueId}/components`);
      if (!response.ok) {
        throw new Error('Failed to fetch issue components');
      }
      const data: IssueComponentsResponse = await response.json();
      return data.components;
    },
    enabled: !!issueId,
  });
}

/** Replace an issue's components (PUT /api/issues/[issueId]/components). */
export function useSetIssueComponents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      issueId,
      componentIds,
    }: {
      issueId: string;
      componentIds: string[];
    }): Promise<ProjectComponent[]> => {
      const response = await fetch(`/api/issues/${issueId}/components`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentIds }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to update issue components');
      }
      const data: IssueComponentsResponse = await response.json();
      return data.components;
    },
    onSuccess: (data, { issueId }) => {
      queryClient.setQueryData(['issue-components', issueId], data);
    },
    onSettled: (_data, _error, { issueId }) => {
      queryClient.invalidateQueries({ queryKey: ['issue-components', issueId] });
      // Per-component issue counts shift when links change.
      queryClient.invalidateQueries({ queryKey: ['project-components'] });
      // The server writes an activity row for the change.
      queryClient.invalidateQueries({ queryKey: ['activities', issueId] });
    },
  });
}
