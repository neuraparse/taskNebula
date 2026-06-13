'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Minimal shape of the parent issue's inheritable context. A child sub-issue
 * inherits the parent's project plus its sprint/epic when those are set,
 * matching the Linear/Plane "create sub-issue" pattern.
 */
export interface SubIssueParentContext {
  projectId: string;
  sprintId?: string | null;
  epicId?: string | null;
}

interface CreateSubIssueInput {
  parentId: string;
  title: string;
  context: SubIssueParentContext;
}

/**
 * Reads the inheritable context (project + sprint/epic when set) of a parent
 * issue so a new sub-issue can adopt it. Falls back to just the project id when
 * the parent fetch is unavailable.
 */
export function useSubIssueParentContext(issueId: string, projectId: string) {
  return useQuery<SubIssueParentContext>({
    queryKey: ['subtask-parent-context', issueId],
    queryFn: async () => {
      const response = await fetch(`/api/issues/${issueId}`);
      if (!response.ok) return { projectId };
      const data = (await response.json()) as {
        projectId?: string;
        sprintId?: string | null;
        epicId?: string | null;
      };
      return {
        projectId: data.projectId || projectId,
        sprintId: data.sprintId ?? null,
        epicId: data.epicId ?? null,
      };
    },
  });
}

/**
 * Creates a child issue under a parent, inheriting the parent's project and
 * (when present) sprint/epic. Invalidates the parent's subtasks list so the
 * panel refreshes optimistically.
 */
export function useCreateSubIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parentId, title, context }: CreateSubIssueInput) => {
      const payload: Record<string, unknown> = {
        projectId: context.projectId,
        title: title.trim(),
        // The create-issue API enum accepts story|task|bug|epic (not 'subtask');
        // a sub-issue is identified by its parentId, so it is created as a task.
        type: 'task',
        priority: 'medium',
        parentId,
      };
      if (context.sprintId) payload.sprintId = context.sprintId;
      if (context.epicId) payload.epicId = context.epicId;

      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || 'Failed to create sub-issue');
      }
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', variables.parentId] });
      queryClient.invalidateQueries({
        queryKey: ['issues'],
        predicate: (query) => {
          const filters = query.queryKey[1] as { projectId?: string } | undefined;
          return filters?.projectId === variables.context.projectId;
        },
      });
      queryClient.invalidateQueries({ queryKey: ['my-issues'] });
      queryClient.invalidateQueries({ queryKey: ['your-work'] });
    },
  });
}
