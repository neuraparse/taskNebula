'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { useToast } from '@/hooks/use-toast';
import { invalidateIssueCaches } from '@/lib/realtime/issue-cache';

/**
 * Draft type as exposed to the rest of the web app. This is a stable UI
 * shape that pre-dates the DB-backed store — the hook translates to/from
 * the `drafts` table (which uses `entityType: issue | doc | other`).
 */
export interface Draft {
  id: string;
  type: 'work_item' | 'page' | 'comment';
  title: string;
  body?: string;
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

/** Row returned by GET /api/drafts (subset we care about). */
interface DraftRow {
  id: string;
  title: string | null;
  content: string | null;
  entityType: string;
  targetProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UseDraftsResult {
  drafts: Draft[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  addDraft: (input: Partial<Draft> & { type: Draft['type'] }) => Promise<Draft | null>;
  updateDraft: (id: string, patch: Partial<Draft>) => Promise<void>;
  removeDraft: (id: string) => Promise<void>;
  promoteDraft: (id: string) => Promise<void>;
}

const DRAFTS_KEY = ['drafts'] as const;

const UI_TO_DB: Record<Draft['type'], 'issue' | 'doc' | 'other'> = {
  work_item: 'issue',
  page: 'doc',
  comment: 'other',
};

const DB_TO_UI: Record<string, Draft['type']> = {
  issue: 'work_item',
  doc: 'page',
  other: 'comment',
};

function rowToDraft(row: DraftRow): Draft {
  return {
    id: row.id,
    type: DB_TO_UI[row.entityType] ?? 'comment',
    title: row.title ?? '',
    body: row.content ?? undefined,
    projectId: row.targetProjectId ?? undefined,
    createdAt: new Date(row.createdAt).getTime(),
    updatedAt: new Date(row.updatedAt).getTime(),
  };
}

async function fetchDrafts(): Promise<Draft[]> {
  const res = await fetch('/api/drafts');
  if (!res.ok) {
    throw new Error('Failed to load drafts');
  }
  const json = (await res.json()) as { drafts: DraftRow[] };
  return (json.drafts ?? []).map(rowToDraft);
}

async function createDraftRequest(input: Partial<Draft> & { type: Draft['type'] }): Promise<Draft> {
  const res = await fetch('/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title ?? '',
      content: input.body ?? null,
      entityType: UI_TO_DB[input.type],
      targetProjectId: input.projectId ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error('Failed to create draft');
  }
  const json = (await res.json()) as { draft: DraftRow };
  return rowToDraft(json.draft);
}

async function patchDraftRequest(id: string, patch: Partial<Draft>): Promise<Draft> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.body !== undefined) body.content = patch.body;
  if (patch.type !== undefined) body.entityType = UI_TO_DB[patch.type];
  if (patch.projectId !== undefined) body.targetProjectId = patch.projectId;

  const res = await fetch(`/api/drafts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error('Failed to update draft');
  }
  const json = (await res.json()) as { draft: DraftRow };
  return rowToDraft(json.draft);
}

async function deleteDraftRequest(id: string): Promise<void> {
  const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error('Failed to delete draft');
  }
}

/**
 * Fetch the user's first accessible project, used as a default target when
 * promoting a work_item draft with no explicit projectId. Returns null if
 * the user isn't in any project yet (caller surfaces a clearer message).
 */
async function pickDefaultProjectId(): Promise<string | null> {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) return null;
    const json = (await res.json()) as { projects?: Array<{ id: string }> } | Array<{ id: string }>;
    const list = Array.isArray(json) ? json : (json.projects ?? []);
    return list[0]?.id ?? null;
  } catch {
    return null;
  }
}

export function useDrafts(): UseDraftsResult {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  const query = useQuery<Draft[], Error>({
    queryKey: DRAFTS_KEY,
    queryFn: fetchDrafts,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: DRAFTS_KEY });
  };

  const createMutation = useMutation<Draft, Error, Partial<Draft> & { type: Draft['type'] }>({
    mutationFn: createDraftRequest,
    onSuccess: invalidate,
  });

  const patchMutation = useMutation<Draft, Error, { id: string; patch: Partial<Draft> }>({
    mutationFn: ({ id, patch }) => patchDraftRequest(id, patch),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteDraftRequest,
    onSuccess: invalidate,
  });

  const addDraft = useCallback<UseDraftsResult['addDraft']>(
    async (input) => {
      try {
        return await createMutation.mutateAsync(input);
      } catch (err) {
        toast({
          title: 'Could not save draft',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
        return null;
      }
    },
    [createMutation, toast]
  );

  const updateDraft = useCallback<UseDraftsResult['updateDraft']>(
    async (id, patch) => {
      try {
        await patchMutation.mutateAsync({ id, patch });
      } catch (err) {
        toast({
          title: 'Could not update draft',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
    [patchMutation, toast]
  );

  const removeDraft = useCallback<UseDraftsResult['removeDraft']>(
    async (id) => {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (err) {
        toast({
          title: 'Could not delete draft',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
    [deleteMutation, toast]
  );

  const promoteDraft = useCallback<UseDraftsResult['promoteDraft']>(
    async (id) => {
      const draft = (query.data ?? []).find((d) => d.id === id);
      if (!draft) {
        toast({
          title: 'Draft not found',
          description: 'Reload the page and try again.',
          variant: 'destructive',
        });
        return;
      }

      // Only work_item drafts currently map to a concrete entity
      // (issues). Pages and comments keep the old no-op behaviour
      // until their own promote flows land.
      if (draft.type !== 'work_item') {
        toast({
          title: 'Not supported yet',
          description:
            draft.type === 'page'
              ? 'Promoting pages to docs is not available yet.'
              : 'Promoting comments is not available yet.',
        });
        return;
      }

      const projectId = draft.projectId ?? (await pickDefaultProjectId());
      if (!projectId) {
        toast({
          title: 'No project available',
          description: 'Join or create a project before promoting drafts to work items.',
          variant: 'destructive',
        });
        return;
      }

      try {
        const res = await fetch('/api/issues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            type: 'task',
            title: draft.title || 'Untitled draft',
            description: draft.body ?? null,
            priority: 'medium',
            labels: [],
            customFields: {},
          }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || 'Failed to create work item');
        }

        const issue = (await res.json()) as {
          id: string;
          key?: string;
          projectId?: string;
          sprintId?: string | null;
        };

        // The promoted draft is now a real issue — refresh every issue-derived
        // surface (project lists, my-issues, your-work, dashboards) so it shows
        // up immediately instead of after a manual page refresh.
        invalidateIssueCaches(queryClient, {
          projectId: issue.projectId ?? projectId,
          sprintId: issue.sprintId ?? null,
          issueId: issue.id,
        });

        // Draft promoted — delete original so it doesn't linger.
        await deleteMutation.mutateAsync(id).catch(() => {
          // Non-fatal: issue was created. Surface but don't abort.
          toast({
            title: 'Draft kept',
            description: 'Work item created, but the draft could not be removed.',
          });
        });

        toast({
          title: 'Promoted to work item',
          description: issue.key ? `Created ${issue.key}.` : 'Work item created successfully.',
        });

        if (issue.id) {
          router.push(`/issues/${issue.id}`);
        }
      } catch (err) {
        toast({
          title: 'Could not promote draft',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
    [query.data, deleteMutation, toast, router, queryClient]
  );

  return {
    drafts: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error ?? null,
    addDraft,
    updateDraft,
    removeDraft,
    promoteDraft,
  };
}
