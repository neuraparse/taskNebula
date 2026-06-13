'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Minimal shape returned by POST /api/issues (the raw inserted issue row).
 * The epic picker only needs identity + display fields, so we keep this
 * narrow rather than importing the full `Issue` type from use-issues.
 */
export interface CreatedEpic {
  id: string;
  key: string;
  title: string;
  type: string;
  projectId: string;
}

/**
 * Inline-create an epic from the Epic picker. An epic is just an issue with
 * `type: 'epic'`, so this reuses the standard POST /api/issues endpoint.
 *
 * Thrown errors carry the HTTP `status` (403 = no permission to create
 * issues) so the picker can branch on the failure mode, mirroring the
 * label/component create-mutations.
 */
export function useCreateEpic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      title,
    }: {
      projectId: string;
      title: string;
    }): Promise<CreatedEpic> => {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title, type: 'epic' }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw Object.assign(new Error(err?.error || 'Failed to create epic'), {
          status: response.status,
        });
      }
      return (await response.json()) as CreatedEpic;
    },
    onSettled: (_data, _error, { projectId }) => {
      // Refresh the epic list that backs the picker, plus the broader issue
      // lists for this project so the new epic shows up everywhere.
      queryClient.invalidateQueries({
        queryKey: ['issues'],
        predicate: (query) => {
          const filters = query.queryKey[1] as { projectId?: string } | undefined;
          return filters?.projectId === projectId;
        },
      });
    },
  });
}
