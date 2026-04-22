'use client';

import { useQuery } from '@tanstack/react-query';
import { useOrganization } from '@/lib/hooks/use-organization';

export type AiCapability = {
  platformEnabled: boolean;
  llm: {
    provider: 'native' | 'openai' | 'anthropic' | 'azure' | 'custom';
    model: string;
    configured: boolean;
    source: 'workspace' | 'platform' | 'server_env' | null;
  };
  assistantEnabled: boolean;
  canDraft: boolean;
  agentsEnabled: boolean;
  canRunAgents: boolean;
};

const DISABLED: AiCapability = {
  platformEnabled: false,
  llm: { provider: 'native', model: '', configured: false, source: null },
  assistantEnabled: false,
  canDraft: false,
  agentsEnabled: false,
  canRunAgents: false,
};

export function useAiCapability() {
  const { currentOrganizationId } = useOrganization();

  const query = useQuery({
    queryKey: ['ai-capability', currentOrganizationId ?? null],
    queryFn: async (): Promise<AiCapability> => {
      const params = currentOrganizationId
        ? `?organizationId=${encodeURIComponent(currentOrganizationId)}`
        : '';
      const response = await fetch(`/api/ai/capability${params}`);
      if (!response.ok) return DISABLED;
      return (await response.json()) as AiCapability;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    ...(query.data ?? DISABLED),
    isLoading: query.isLoading,
  };
}
