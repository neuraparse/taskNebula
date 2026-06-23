'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export interface WorkflowStatus {
  id: string;
  name: string;
  category: string;
  color: string;
  position: number;
}

export function useWorkflowStatuses(projectId: string | undefined) {
  const t = useTranslations('hookErrors.workflowStatuses');

  return useQuery({
    queryKey: ['workflow-statuses', projectId],
    queryFn: async () => {
      if (!projectId) return [] as WorkflowStatus[];
      const res = await fetch(`/api/projects/${projectId}/workflow-statuses`);
      if (!res.ok) throw new Error(t('load'));
      const data = await res.json();
      return (data.statuses || []) as WorkflowStatus[];
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
