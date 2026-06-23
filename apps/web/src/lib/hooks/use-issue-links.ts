'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

export type IssueLinkType =
  | 'blocks'
  | 'blocked_by'
  | 'relates_to'
  | 'duplicates'
  | 'duplicated_by'
  | 'parent_of'
  | 'child_of';

export interface LinkedIssue {
  id: string;
  key: string;
  title: string;
  statusId: string;
  type: string;
  priority: string;
}

export interface IssueLink {
  id: string;
  type: IssueLinkType;
  issue: LinkedIssue;
  direction: 'outbound' | 'inbound';
  createdAt: Date;
}

export interface IssueLinksData {
  outbound: IssueLink[];
  inbound: IssueLink[];
}

// Fetch issue links
export function useIssueLinks(issueId: string | null) {
  const t = useTranslations('hookErrors.issueLinks');

  return useQuery({
    queryKey: ['issue-links', issueId],
    queryFn: async () => {
      if (!issueId) return null;
      const response = await fetch(`/api/issues/${issueId}/links`);
      if (!response.ok) throw new Error(t('fetch'));
      return response.json() as Promise<IssueLinksData>;
    },
    enabled: !!issueId,
  });
}

// Create issue link
export function useCreateIssueLink() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.issueLinks');

  return useMutation({
    mutationFn: async ({
      issueId,
      targetIssueId,
      type,
    }: {
      issueId: string;
      targetIssueId: string;
      type: IssueLinkType;
    }) => {
      const response = await fetch(`/api/issues/${issueId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetIssueId, type }),
      });
      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(error.error || t('create'));
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate both issues' links
      queryClient.invalidateQueries({ queryKey: ['issue-links', variables.issueId] });
      queryClient.invalidateQueries({ queryKey: ['issue-links', variables.targetIssueId] });
    },
  });
}

// Delete issue link
export function useDeleteIssueLink() {
  const queryClient = useQueryClient();
  const t = useTranslations('hookErrors.issueLinks');

  return useMutation({
    mutationFn: async ({ issueId, linkId }: { issueId: string; linkId: string }) => {
      const response = await fetch(`/api/issues/${issueId}/links?linkId=${linkId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(t('delete'));
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['issue-links', variables.issueId] });
    },
  });
}

// Helper function to get link type display name
export function getLinkTypeLabel(type: IssueLinkType, direction: 'outbound' | 'inbound'): string {
  if (direction === 'outbound') {
    switch (type) {
      case 'blocks':
        return 'blocks';
      case 'blocked_by':
        return 'is blocked by';
      case 'relates_to':
        return 'relates to';
      case 'duplicates':
        return 'duplicates';
      case 'duplicated_by':
        return 'is duplicated by';
      case 'parent_of':
        return 'is parent of';
      case 'child_of':
        return 'is child of';
      default:
        return type;
    }
  } else {
    // Inbound - reverse the relationship
    switch (type) {
      case 'blocks':
        return 'is blocked by';
      case 'blocked_by':
        return 'blocks';
      case 'relates_to':
        return 'relates to';
      case 'duplicates':
        return 'is duplicated by';
      case 'duplicated_by':
        return 'duplicates';
      case 'parent_of':
        return 'is child of';
      case 'child_of':
        return 'is parent of';
      default:
        return type;
    }
  }
}

// Helper function to get inverse link type
export function getInverseLinkType(type: IssueLinkType): IssueLinkType {
  switch (type) {
    case 'blocks':
      return 'blocked_by';
    case 'blocked_by':
      return 'blocks';
    case 'duplicates':
      return 'duplicated_by';
    case 'duplicated_by':
      return 'duplicates';
    case 'parent_of':
      return 'child_of';
    case 'child_of':
      return 'parent_of';
    case 'relates_to':
      return 'relates_to';
    default:
      return type;
  }
}
