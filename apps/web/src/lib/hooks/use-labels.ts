'use client';

import { useQuery } from '@tanstack/react-query';

/** Label row as returned by GET /api/labels (first-class labels table, migration 0054). */
export interface OrgLabel {
  id: string;
  organizationId: string;
  /** NULL = org-wide label; otherwise scoped to a single project. */
  projectId: string | null;
  name: string;
  color: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  /** Number of issues currently linked through issue_labels. */
  usageCount: number;
}

interface LabelsResponse {
  labels: OrgLabel[];
}

interface UseLabelsOptions {
  /** Scope results to a project (returns project labels + org-wide ones). */
  projectId?: string;
  /** Server-side prefix search (`?q=`). */
  q?: string;
}

/**
 * Fetch the org's labels (optionally scoped to a project and/or filtered
 * by a name prefix). Mirrors `useIssues` — plain fetch + TanStack Query.
 */
export function useLabels(organizationId: string | null, options?: UseLabelsOptions) {
  const projectId = options?.projectId ?? null;
  const q = options?.q?.trim() ?? '';

  return useQuery({
    queryKey: ['labels', organizationId, projectId, q],
    queryFn: async (): Promise<OrgLabel[]> => {
      if (!organizationId) return [];
      const params = new URLSearchParams({ organizationId });
      if (projectId) params.set('projectId', projectId);
      if (q) params.set('q', q);

      const response = await fetch(`/api/labels?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch labels');
      }
      const data: LabelsResponse = await response.json();
      return data.labels;
    },
    enabled: !!organizationId,
  });
}
