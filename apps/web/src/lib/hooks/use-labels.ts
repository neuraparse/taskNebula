'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { throwApiResponseError } from '@/lib/client-api-errors';

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
        await throwApiResponseError(response);
      }
      const data: LabelsResponse = await response.json();
      return data.labels;
    },
    enabled: !!organizationId,
  });
}

/**
 * Design-system accent palette — light-mode hex equivalents of the
 * `--accent-*` tokens in globals.css. `labels.color` stores a literal hex
 * (the API validates `#rgb`/`#rrggbb`), so the tokens are resolved here once.
 */
export const LABEL_ACCENT_PALETTE: readonly string[] = [
  '#2385F6', // accent-blue
  '#8F51EC', // accent-violet
  '#1AB8D1', // accent-cyan
  '#22B47F', // accent-emerald
  '#F6A123', // accent-amber
  '#EF4366', // accent-rose
  '#494FE9', // accent-indigo
];

/**
 * Deterministic name → DS accent color for inline-created labels.
 * Hashing (vs cycling) keeps the color stable across clients and sessions.
 */
export function labelColorForName(name: string): string {
  const normalized = name.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) | 0;
  }
  return LABEL_ACCENT_PALETTE[Math.abs(hash) % LABEL_ACCENT_PALETTE.length]!;
}

/** POST /api/labels returns the bare inserted row — no usage count yet. */
export type CreatedLabel = Omit<OrgLabel, 'usageCount'>;

/**
 * Create a label (POST /api/labels — plain org membership is enough).
 *
 * Always creates ORG-WIDE labels (no projectId): the issue-PATCH write-through
 * sync (`resolveLabels`) only matches org-wide rows, so a project-scoped row
 * would be shadowed by a second default-gray org-wide label on first use.
 *
 * Thrown errors carry the HTTP `status` (403 = not an org member,
 * 409 = duplicate name) so pickers can branch on the failure mode.
 */
export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      name,
      color,
    }: {
      organizationId: string;
      name: string;
      /** Hex color; defaults to the deterministic DS accent for the name. */
      color?: string;
    }): Promise<CreatedLabel> => {
      const response = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          name,
          color: color ?? labelColorForName(name),
        }),
      });
      if (!response.ok) {
        await throwApiResponseError(response);
      }
      return (await response.json()) as CreatedLabel;
    },
    onSettled: (_data, _error, { organizationId }) => {
      // Catalog + every ?q= autocomplete variant for the org.
      queryClient.invalidateQueries({ queryKey: ['labels', organizationId] });
    },
  });
}
