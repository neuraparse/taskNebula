'use client';

import { useQuery } from '@tanstack/react-query';

export interface WorkflowStatus {
  id: string;
  name: string;
  category: string;
  color: string;
  position: number;
}

export function useWorkflowStatuses(projectId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-statuses', projectId],
    queryFn: async () => {
      if (!projectId) return [] as WorkflowStatus[];
      const res = await fetch(`/api/projects/${projectId}/workflow-statuses`);
      if (!res.ok) throw new Error('Failed to load workflow statuses');
      const data = await res.json();
      return (data.statuses || []) as WorkflowStatus[];
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
