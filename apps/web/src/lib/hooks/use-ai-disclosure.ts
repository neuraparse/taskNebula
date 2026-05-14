'use client';

/**
 * useAiDisclosure — drives the first-time AI involvement modal mandated by
 * EU AI Act Article 50 (enforcement 2026-08-02).
 *
 * Logic:
 *   1. The current `DISCLOSURE_VERSION` is loaded from the model-cards config.
 *   2. On mount, GET /api/ai/disclosures returns the set of versions the
 *      current (user, workspace) has already acknowledged.
 *   3. If the current version is NOT in that set, the consumer renders the
 *      <AiDisclosureModal>.
 *   4. acknowledge() POSTs the version, optimistically updates the local
 *      cache, and resolves so the consumer can close the modal.
 *
 * Falls back gracefully if the endpoint is unavailable — the modal won't
 * block usage if the API is unreachable, but it will re-show on next load.
 */

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOrganization } from '@/lib/hooks/use-organization';
import { DISCLOSURE_VERSION } from '@/config/ai-model-cards';

type DisclosuresResponse = {
  acknowledgedVersions: string[];
};

async function fetchAcknowledgements(
  workspaceId: string
): Promise<DisclosuresResponse> {
  try {
    const r = await fetch(
      `/api/ai/disclosures?workspaceId=${encodeURIComponent(workspaceId)}`
    );
    if (!r.ok) return { acknowledgedVersions: [] };
    return (await r.json()) as DisclosuresResponse;
  } catch {
    return { acknowledgedVersions: [] };
  }
}

async function postAcknowledgement(
  workspaceId: string,
  version: string
): Promise<void> {
  await fetch('/api/ai/disclosures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, version }),
  });
}

export interface AiDisclosureState {
  /** Whether the current version still needs to be acknowledged. */
  needsAcknowledgement: boolean;
  /** Disclosure copy version about to be (or already) shown. */
  version: string;
  /** True while the GET request is in flight. */
  isLoading: boolean;
  /** Persist the acknowledgement. Returns a Promise so callers can await. */
  acknowledge: () => Promise<void>;
}

export function useAiDisclosure(): AiDisclosureState {
  const { currentOrganizationId } = useOrganization();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-disclosures', currentOrganizationId ?? null],
    queryFn: () =>
      currentOrganizationId
        ? fetchAcknowledgements(currentOrganizationId)
        : Promise.resolve({ acknowledgedVersions: [] }),
    enabled: !!currentOrganizationId,
    staleTime: Infinity, // acknowledgements are immutable per version
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganizationId) return;
      await postAcknowledgement(currentOrganizationId, DISCLOSURE_VERSION);
    },
    onSuccess: () => {
      // Optimistically add the new version to the cached set so the modal
      // does not re-appear in the same session.
      queryClient.setQueryData<DisclosuresResponse>(
        ['ai-disclosures', currentOrganizationId ?? null],
        (prev) => ({
          acknowledgedVersions: Array.from(
            new Set([...(prev?.acknowledgedVersions ?? []), DISCLOSURE_VERSION])
          ),
        })
      );
    },
  });

  const acknowledge = useCallback(async () => {
    await mutation.mutateAsync();
  }, [mutation]);

  const acknowledged = query.data?.acknowledgedVersions ?? [];
  const needsAcknowledgement =
    !!currentOrganizationId &&
    !query.isLoading &&
    !acknowledged.includes(DISCLOSURE_VERSION);

  return {
    needsAcknowledgement,
    version: DISCLOSURE_VERSION,
    isLoading: query.isLoading,
    acknowledge,
  };
}
