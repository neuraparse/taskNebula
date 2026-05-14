'use client';

/**
 * useAiTrace — fetches transparency metadata for a single AI operation so the
 * AiBadge tooltip can show "<model> · <feature> · <timestamp>".
 *
 * The endpoint /api/ai/trace/[id] returns the trace row from the AI run log.
 * For surfaces that already know the metadata (model + feature + timestamp
 * arrive in the response body) the operationId is optional — callers can pass
 * the data directly to <AiBadge> and skip this hook entirely.
 *
 * Required by EU AI Act Article 50 (2026-08-02) transparency obligations.
 */

import { useQuery } from '@tanstack/react-query';

export interface AiTrace {
  operationId: string;
  /** The display feature name, e.g. "Draft Issue", "Triage Suggestion". */
  feature: string;
  /** The model identifier surfaced to the user, e.g. "Claude Sonnet 4.7". */
  model: string;
  /** Provider, e.g. "anthropic" | "openai". */
  provider?: string;
  /** When the AI run completed. ISO string. */
  generatedAt: string;
  /** The workspace this run executed in. */
  workspaceId?: string;
  /** Optional human reviewer who approved/applied this output. */
  reviewedBy?: string | null;
}

async function fetchAiTrace(operationId: string): Promise<AiTrace | null> {
  try {
    const r = await fetch(`/api/ai/trace/${encodeURIComponent(operationId)}`);
    if (!r.ok) return null;
    return (await r.json()) as AiTrace;
  } catch {
    return null;
  }
}

/**
 * Resolves AI trace metadata for the badge tooltip.
 *
 * Pass `undefined`/`null` to short-circuit — useful when the parent already
 * has the metadata inline.
 */
export function useAiTrace(operationId?: string | null): AiTrace | null {
  const query = useQuery({
    queryKey: ['ai-trace', operationId ?? null],
    queryFn: () => fetchAiTrace(operationId as string),
    enabled: !!operationId,
    staleTime: 5 * 60 * 1000, // 5 min — trace rows are immutable
    refetchOnWindowFocus: false,
  });
  return query.data ?? null;
}
