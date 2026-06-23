import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  enabledForPlans: string[];
  enabledForOrganizations: string[];
  rolloutPercentage: number;
  metadata: Record<string, any>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Get all feature flags (super admin only)
export function useFeatureFlags() {
  const t = useTranslations('hookErrors.featureFlags');

  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const response = await fetch('/api/admin/feature-flags');
      if (!response.ok) {
        throw new Error(t('fetchAll'));
      }
      const data = await response.json();
      return data.featureFlags as FeatureFlag[];
    },
  });
}

// Get single feature flag
export function useFeatureFlag(flagId: string | null) {
  const t = useTranslations('hookErrors.featureFlags');

  return useQuery({
    queryKey: ['feature-flag', flagId],
    queryFn: async () => {
      if (!flagId) return null;
      const response = await fetch(`/api/admin/feature-flags/${flagId}`);
      if (!response.ok) {
        throw new Error(t('fetchOne'));
      }
      return response.json() as Promise<FeatureFlag>;
    },
    enabled: !!flagId,
  });
}

// Create feature flag
export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.featureFlags');

  return useMutation({
    mutationFn: async (data: {
      key: string;
      name: string;
      description?: string;
      isEnabled?: boolean;
      enabledForPlans?: string[];
      enabledForOrganizations?: string[];
      rolloutPercentage?: number;
      metadata?: Record<string, any>;
    }) => {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || t('create'));
      }

      return response.json() as Promise<FeatureFlag>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });
}

// Update feature flag
export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.featureFlags');

  return useMutation({
    mutationFn: async ({
      flagId,
      data,
    }: {
      flagId: string;
      data: {
        key?: string;
        name?: string;
        description?: string;
        isEnabled?: boolean;
        enabledForPlans?: string[];
        enabledForOrganizations?: string[];
        rolloutPercentage?: number;
        metadata?: Record<string, any>;
      };
    }) => {
      const response = await fetch(`/api/admin/feature-flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || t('update'));
      }

      return response.json() as Promise<FeatureFlag>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flag', variables.flagId] });
    },
  });
}

// Delete feature flag
export function useDeleteFeatureFlag() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.featureFlags');

  return useMutation({
    mutationFn: async (flagId: string) => {
      const response = await fetch(`/api/admin/feature-flags/${flagId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || t('delete'));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });
}
