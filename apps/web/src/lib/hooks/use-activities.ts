import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface Activity {
  id: string;
  type: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string | Date;
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ActivitiesResponse {
  activities: Activity[];
}

export function useActivities(issueId: string) {
  const t = useTranslations('hookErrors.activities');

  return useQuery({
    queryKey: ['activities', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/issues/${issueId}/activities`);
      if (!response.ok) {
        throw new Error(t('fetch'));
      }
      const data: ActivitiesResponse = await response.json();
      return data.activities;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}
