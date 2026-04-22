'use client';

import { useAiCapability } from './use-ai-capability';

/**
 * Legacy compatibility shim. Call sites should migrate to
 * `useAiCapability()` which also exposes org-level state + credential
 * presence. Kept so existing components don't break during the move.
 */
export function useAiFeature() {
  const { platformEnabled, isLoading } = useAiCapability();
  return {
    aiEnabled: platformEnabled,
    isLoading,
  };
}
