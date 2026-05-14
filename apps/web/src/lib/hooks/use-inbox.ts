/**
 * React-query hooks for the Smart Inbox surface.
 *
 * The list query is filter-aware (filters become part of the query key so
 * each chip combination caches independently) and uses
 * `useInfiniteQuery`-like cursor semantics via the `cursor` param. We avoid
 * `useInfiniteQuery` here because the inbox typically fits a single page
 * and the simpler shape makes the page logic easier to read.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type InboxActorType = 'user' | 'agent' | 'webhook' | 'system';
export type InboxNotificationType =
  | 'mention'
  | 'assignment'
  | 'due'
  | 'status'
  | 'comment'
  | 'reaction';

export interface InboxFilters {
  actorType?: InboxActorType | null;
  notificationType?: InboxNotificationType | null;
  unread?: boolean;
  snoozed?: boolean;
  projectId?: string | null;
  since?: string | null;
  until?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface InboxItem {
  id: string;
  type: string;
  actorType: InboxActorType;
  title: string;
  message: string;
  issueId: string | null;
  projectId: string | null;
  isRead: boolean;
  readAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  issue: {
    id: string;
    key: string;
    title: string;
  } | null;
  project: {
    id: string;
    key: string;
    name: string;
  } | null;
}

export interface InboxResponse {
  items: InboxItem[];
  nextCursor: string | null;
}

function buildInboxUrl(filters: InboxFilters): string {
  const params = new URLSearchParams();
  if (filters.actorType) params.set('actor_type', filters.actorType);
  if (filters.notificationType) params.set('notification_type', filters.notificationType);
  if (filters.unread) params.set('unread', 'true');
  if (filters.snoozed) params.set('snoozed', 'true');
  if (filters.projectId) params.set('project', filters.projectId);
  if (filters.since) params.set('since', filters.since);
  if (filters.until) params.set('until', filters.until);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `/api/inbox?${qs}` : '/api/inbox';
}

export function useInbox(filters: InboxFilters = {}) {
  return useQuery({
    queryKey: ['inbox', filters],
    queryFn: async (): Promise<InboxResponse> => {
      const response = await fetch(buildInboxUrl(filters));
      if (!response.ok) throw new Error('Failed to fetch inbox');
      return response.json() as Promise<InboxResponse>;
    },
    refetchInterval: 60_000,
  });
}

export function useInboxSnooze() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, until }: { id: string; until: string | null }) => {
      const response = await fetch(`/api/inbox/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ until }),
      });
      if (!response.ok) throw new Error('Failed to snooze inbox item');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useInboxMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/inbox/${id}/mark-read`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to mark inbox item as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useInboxMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (filters: InboxFilters = {}) => {
      const params = new URLSearchParams();
      if (filters.actorType) params.set('actor_type', filters.actorType);
      if (filters.notificationType) params.set('notification_type', filters.notificationType);
      if (filters.projectId) params.set('project', filters.projectId);
      if (filters.since) params.set('since', filters.since);
      if (filters.until) params.set('until', filters.until);
      const qs = params.toString();
      const url = qs ? `/api/inbox/mark-all-read?${qs}` : '/api/inbox/mark-all-read';
      const response = await fetch(url, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to mark all inbox items as read');
      return response.json() as Promise<{ success: boolean; count: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export interface CatchMeUpActionItem {
  title: string;
  link: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface CatchMeUpResponse {
  summary_markdown: string;
  action_items: CatchMeUpActionItem[];
  since: string;
  source: 'native' | 'anthropic' | 'openai';
}

export function useCatchMeUp(opts: { since?: string | null; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['inbox', 'catch-me-up', opts.since ?? null],
    queryFn: async (): Promise<CatchMeUpResponse> => {
      const params = new URLSearchParams();
      if (opts.since) params.set('since', opts.since);
      const url = params.toString()
        ? `/api/inbox/catch-me-up?${params.toString()}`
        : '/api/inbox/catch-me-up';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch catch-me-up digest');
      return response.json() as Promise<CatchMeUpResponse>;
    },
    enabled: opts.enabled !== false,
    staleTime: 60_000,
  });
}
