'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/** project_versions row (Jira-parity Fix/Affects Version layer). */
export interface ProjectVersion {
  id: string;
  organizationId: string;
  projectId: string;
  name: string;
  description: string | null;
  status: 'unreleased' | 'released' | 'archived';
  startDate: string | null;
  /** Planned release date (editable target). */
  releaseDate: string | null;
  /** Actual moment the version was marked released. */
  releasedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** Version + per-version counts from GET /api/projects/[projectId]/versions. */
export interface ProjectVersionWithCounts extends ProjectVersion {
  issueCount: number;
  doneIssueCount: number;
}

interface ProjectVersionsResponse {
  versions: ProjectVersionWithCounts[];
  total: number;
}

/** Shape of GET/PUT /api/issues/[issueId]/versions. */
export interface IssueVersions {
  fixVersions: ProjectVersion[];
  affectsVersions: ProjectVersion[];
}

/** All versions of a project (API orders by sortOrder, then name). */
export function useProjectVersions(projectId: string | null) {
  return useQuery({
    queryKey: ['project-versions', projectId],
    queryFn: async (): Promise<ProjectVersionWithCounts[]> => {
      if (!projectId) return [];
      const response = await fetch(`/api/projects/${projectId}/versions`);
      if (!response.ok) {
        throw new Error('Failed to fetch project versions');
      }
      const data: ProjectVersionsResponse = await response.json();
      return data.versions;
    },
    enabled: !!projectId,
  });
}

/** Fix + affects versions linked to an issue. */
export function useIssueVersions(issueId: string | null) {
  return useQuery({
    queryKey: ['issue-versions', issueId],
    queryFn: async (): Promise<IssueVersions> => {
      if (!issueId) return { fixVersions: [], affectsVersions: [] };
      const response = await fetch(`/api/issues/${issueId}/versions`);
      if (!response.ok) {
        throw new Error('Failed to fetch issue versions');
      }
      return response.json() as Promise<IssueVersions>;
    },
    enabled: !!issueId,
  });
}

/**
 * Replace an issue's fix and/or affects versions
 * (PUT /api/issues/[issueId]/versions — omitted arrays are left untouched).
 */
export function useSetIssueVersions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      issueId,
      fixVersionIds,
      affectsVersionIds,
    }: {
      issueId: string;
      fixVersionIds?: string[];
      affectsVersionIds?: string[];
    }) => {
      const response = await fetch(`/api/issues/${issueId}/versions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(fixVersionIds !== undefined ? { fixVersionIds } : {}),
          ...(affectsVersionIds !== undefined ? { affectsVersionIds } : {}),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || 'Failed to update issue versions');
      }
      return response.json() as Promise<IssueVersions>;
    },
    onSuccess: (data, { issueId }) => {
      // The PUT echoes the fresh state — seed the cache directly.
      queryClient.setQueryData(['issue-versions', issueId], data);
    },
    onSettled: (_data, _error, { issueId }) => {
      queryClient.invalidateQueries({ queryKey: ['issue-versions', issueId] });
      // Per-version issue counts shift when links change.
      queryClient.invalidateQueries({ queryKey: ['project-versions'] });
      // The server writes an activity row for the change.
      queryClient.invalidateQueries({ queryKey: ['activities', issueId] });
    },
  });
}
