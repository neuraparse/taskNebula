'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { throwApiResponseError } from '@/lib/client-api-errors';
import {
  invalidateIssueCaches,
  matchesIssueList,
  issueMatchesListFilters,
} from '@/lib/realtime/issue-cache';
import type { WorkflowStatus } from '@/lib/hooks/use-workflow-statuses';

export interface Issue {
  id: string;
  key: string;
  number?: number;
  title: string;
  description: string | null;
  /** ProseMirror JSON snapshot mirroring the collaborative editor state.
   *  Set by the collab editor (P1-09 follow-up). When present the read
   *  path renders this rich content; otherwise it falls back to `description`. */
  descriptionRich?: Record<string, unknown> | null;
  type: string;
  status: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  priority: string;
  assigneeId: string | null;
  reporterId: string;
  organizationId: string;
  projectId: string;
  sprintId: string | null;
  estimate: number | null;
  labels?: string[];
  dueDate?: string | null;
  flagged?: boolean | null;
  storyPoints?: number | null;
  customFields?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  /** True while an optimistic create is in flight; cleared once the server
   *  responds and the real row replaces it. UI can use this to render the card
   *  in a pending/dimmed state. */
  optimistic?: boolean;
  assignee?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  reporter?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

interface IssuesResponse {
  issues: Issue[];
}

interface IssueFilters {
  projectId?: string;
  assigneeId?: string;
  status?: string;
  sprintId?: string;
  type?: string;
}

// Fetch issues with filters
export function useIssues(filters?: IssueFilters, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['issues', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.projectId) params.append('projectId', filters.projectId);
      if (filters?.assigneeId) params.append('assigneeId', filters.assigneeId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.sprintId) params.append('sprintId', filters.sprintId);
      if (filters?.type) params.append('type', filters.type);

      const response = await fetch(`/api/issues?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch issues');
      }
      const data: IssuesResponse = await response.json();
      return data.issues;
    },
    enabled: options.enabled !== false,
  });
}

// Fetch single issue
export function useIssue(issueId: string | null) {
  return useQuery({
    queryKey: ['issue', issueId],
    queryFn: async (): Promise<Issue | null> => {
      if (!issueId) throw new Error('Issue ID is required');
      const response = await fetch(`/api/issues/${issueId}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        await throwApiResponseError(response, 'Failed to fetch issue');
      }
      const data = await response.json();
      return data as Issue;
    },
    enabled: !!issueId,
  });
}

// Monotonic counter for optimistic temp ids. Module-scoped so concurrent
// creates (e.g. rapid keyboard entry) never collide.
let optimisticIssueSeq = 0;

type CreateIssueInput = Partial<Issue> & { parentId?: string };

interface CreateIssueContext {
  /** Snapshot of every issue-list cache we touched, for rollback on error. */
  prevLists: Array<[readonly unknown[], Issue[] | undefined]>;
  tempId: string;
}

// Create issue mutation — optimistic: the new card appears the instant the
// form is submitted (no waiting on the POST + refetch round-trip), then is
// reconciled with the server row on success and re-validated on settle. This
// is what makes "add a task" feel instant instead of requiring a page refresh.
export function useCreateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateIssueInput) => {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', error);
        throw new Error(error.error || 'Failed to create issue');
      }
      return response.json();
    },

    onMutate: async (variables): Promise<CreateIssueContext> => {
      const projectId = variables.projectId;

      // Stop in-flight list refetches from clobbering the optimistic insert.
      await queryClient.cancelQueries({
        predicate: (query) => matchesIssueList(query.queryKey, projectId),
      });

      // Best-effort status guess so the card lands in the right Kanban column
      // immediately. The API assigns the backlog status when none is given, so
      // mirror that by falling back to the first/backlog workflow status.
      const wfStatuses = projectId
        ? queryClient.getQueryData<WorkflowStatus[]>(['workflow-statuses', projectId])
        : undefined;
      const orderedStatuses = wfStatuses
        ? [...wfStatuses].sort((a, b) => a.position - b.position)
        : [];
      const fallbackStatusId =
        variables.statusId ??
        orderedStatuses.find((s) => s.category === 'backlog' || s.category === 'todo')?.id ??
        orderedStatuses[0]?.id;

      const tempId = `optimistic-${++optimisticIssueSeq}`;
      const now = new Date().toISOString();
      const optimisticIssue: Issue = {
        id: tempId,
        key: '',
        title: variables.title ?? '',
        description: variables.description ?? null,
        type: variables.type ?? 'task',
        status: '',
        statusId: fallbackStatusId,
        priority: variables.priority ?? 'medium',
        assigneeId: variables.assigneeId ?? null,
        reporterId: '',
        organizationId: '',
        projectId: projectId ?? '',
        sprintId: variables.sprintId ?? null,
        estimate: null,
        labels: variables.labels ?? [],
        createdAt: now,
        updatedAt: now,
        optimistic: true,
      };

      // Insert into every matching list cache, respecting each list's sprint
      // filter so the card doesn't flash into the wrong sprint/backlog view.
      const prevLists = queryClient.getQueriesData<Issue[]>({
        predicate: (query) => matchesIssueList(query.queryKey, projectId),
      });
      for (const [key, data] of prevLists) {
        if (!data) continue;
        const filters = key[1] as
          | { assigneeId?: string; sprintId?: string; type?: string; status?: string }
          | undefined;
        if (!issueMatchesListFilters(optimisticIssue, filters)) continue;
        queryClient.setQueryData<Issue[]>(key, [optimisticIssue, ...data]);
      }

      return { prevLists, tempId };
    },

    onError: (_err, _variables, context) => {
      // Roll back every list we mutated.
      if (context?.prevLists) {
        for (const [key, data] of context.prevLists) {
          queryClient.setQueryData(key, data);
        }
      }
    },

    onSuccess: (data, _variables, context) => {
      const created = data as Issue | undefined;
      if (context?.tempId && created?.id) {
        // Swap the temp row for the real server row in place (keeps position).
        // Match by the globally-unique tempId across ALL issue lists rather than
        // by project id: the list was keyed by the project *key* the caller used,
        // while `created.projectId` is the server CUID — a project-scoped
        // predicate would miss the very list holding the temp row. Merge so any
        // client-side fields the bare insert row carries aren't dropped, and
        // clear the pending flag.
        queryClient.setQueriesData<Issue[]>(
          { predicate: (query) => matchesIssueList(query.queryKey) },
          (old) =>
            old
              ? old.map((i) =>
                  i.id === context.tempId ? { ...i, ...created, optimistic: undefined } : i
                )
              : old
        );
        queryClient.setQueryData<Issue>(['issue', created.id], created);
      }
    },

    onSettled: (data, _error, variables) => {
      const created = data as Issue | undefined;
      // Lists + project families are invalidated broadly (key/CUID-agnostic);
      // only sprint/parent ids (real CUIDs) need to be passed through.
      invalidateIssueCaches(queryClient, {
        sprintId: created?.sprintId ?? variables.sprintId,
        parentId: variables.parentId,
      });
    },
  });
}

// Update issue mutation
export function useUpdateIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ issueId, data }: { issueId: string; data: Partial<Issue> }) => {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        await throwApiResponseError(response);
      }
      return response.json();
    },

    // Optimistic update
    onMutate: async ({ issueId, data }) => {
      // Cancel any outgoing refetches that would overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['issues'] });
      await queryClient.cancelQueries({ queryKey: ['issue', issueId] });

      // Snapshot all ['issues', ...] queries currently cached
      const prevListsEntries = queryClient.getQueriesData<Issue[]>({ queryKey: ['issues'] });
      const prevIssue = queryClient.getQueryData<Issue>(['issue', issueId]);

      // Apply the patch optimistically across ALL matching list caches
      queryClient.setQueriesData<Issue[]>({ queryKey: ['issues'] }, (oldList) => {
        if (!oldList) return oldList;
        return oldList.map((i) => (i.id === issueId ? { ...i, ...data } : i));
      });

      if (prevIssue) {
        queryClient.setQueryData<Issue>(['issue', issueId], { ...prevIssue, ...data });
      }

      return { prevListsEntries, prevIssue };
    },

    onError: (_err, { issueId }, context) => {
      // Rollback
      if (context?.prevListsEntries) {
        for (const [key, data] of context.prevListsEntries) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.prevIssue) {
        queryClient.setQueryData(['issue', issueId], context.prevIssue);
      }
    },

    onSuccess: (data) => {
      const updated = data as Issue | undefined;
      if (updated?.id) {
        queryClient.setQueryData(['issue', updated.id], updated);
      }
    },

    onSettled: (data, _error, { issueId }) => {
      // Always reconcile with server truth. Lists/project families invalidate
      // broadly; issueId/sprintId (real CUIDs) match exactly.
      const updated = data as Issue | undefined;
      invalidateIssueCaches(queryClient, {
        issueId,
        sprintId: updated?.sprintId,
      });
    },
  });
}

interface DeleteIssueContext {
  prevLists: Array<[readonly unknown[], Issue[] | undefined]>;
  sprintId?: string | null;
}

// Delete issue mutation — optimistic: the card disappears immediately, with
// rollback if the server rejects the delete.
export function useDeleteIssue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (issueId: string) => {
      // Capture projectId from cache before deletion so we can scope invalidation
      const cached = queryClient.getQueryData<Issue>(['issue', issueId]);
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete issue');
      }
      return { ...(await response.json()), projectId: cached?.projectId };
    },

    onMutate: async (issueId): Promise<DeleteIssueContext> => {
      const cached = queryClient.getQueryData<Issue>(['issue', issueId]);
      // Remove by id across ALL issue lists. We can't scope by project id: the
      // cached issue carries the CUID while boards are keyed by the project key,
      // so a scoped match would miss the very list the card is shown in.
      // Removing a non-present id from other lists is a harmless no-op.
      await queryClient.cancelQueries({
        predicate: (query) => matchesIssueList(query.queryKey),
      });
      const prevLists = queryClient.getQueriesData<Issue[]>({
        predicate: (query) => matchesIssueList(query.queryKey),
      });
      for (const [key, data] of prevLists) {
        if (!data) continue;
        queryClient.setQueryData<Issue[]>(
          key,
          data.filter((i) => i.id !== issueId)
        );
      }
      return { prevLists, sprintId: cached?.sprintId ?? null };
    },

    onError: (_err, _issueId, context) => {
      if (context?.prevLists) {
        for (const [key, data] of context.prevLists) {
          queryClient.setQueryData(key, data);
        }
      }
    },

    onSettled: (_data, _error, issueId, context) => {
      // issueId is the real CUID; invalidating ['issue', issueId] clears the
      // now-deleted detail cache. Lists/project families invalidate broadly.
      invalidateIssueCaches(queryClient, {
        issueId,
        sprintId: context?.sprintId,
      });
    },
  });
}
