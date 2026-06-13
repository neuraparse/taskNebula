'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Star, Bell, Copy, Check, Inbox, ChevronRight, Pencil, Flag } from 'lucide-react';
import { PresenceAvatars } from '@/components/presence/presence-avatars';
import { ISSUE_TYPE_CONFIG, ISSUE_TYPE_FALLBACK } from './type-picker';
import { useUpdateIssue } from '@/lib/hooks/use-issues';
import { useUser } from '@/lib/hooks/use-user';
import type { PinnedItem } from '@/components/dashboard/pinned-items-widget';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface IssueHeaderProps {
  issue: {
    id: string;
    key: string;
    type: string;
    title: string;
    status: string;
    number?: number;
    projectKey?: string;
    flagged?: boolean | null;
  };
}

// Derive the "PROJ" prefix and the numeric/identifier suffix from whatever
// fields are present on the issue. The canonical key looks like "ACME-23".
function splitIssueKey(key: string): { prefix: string | null; suffix: string } {
  const dashIdx = key.lastIndexOf('-');
  if (dashIdx <= 0) return { prefix: null, suffix: key };
  return { prefix: key.slice(0, dashIdx), suffix: key.slice(dashIdx + 1) };
}

interface IssueWatcher {
  id: string;
  userId: string;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}

/** Watch state shared with the sidebar's WatchersList via the same query key. */
function useIssueWatch(issueId: string) {
  const { user } = useUser();
  const queryClient = useQueryClient();
  // Key shape mirrors WatchersList (['watchers', issueId, projectId?]) so the
  // header toggle and the sidebar list can never disagree.
  const queryKey = ['watchers', issueId, undefined];

  const { data } = useQuery({
    queryKey,
    queryFn: async (): Promise<{ watchers: IssueWatcher[] }> => {
      const response = await fetch(`/api/watchers?issueId=${issueId}`);
      if (!response.ok) throw new Error('Failed to fetch watchers');
      return response.json();
    },
  });

  const watchers = data?.watchers ?? [];
  const isWatching = watchers.some((watcher) => watcher.userId === user?.id);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['watchers', issueId] });

  const addWatcher = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/watchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueId }),
      });
      if (!response.ok) throw new Error('Failed to add watcher');
      return response.json();
    },
    onSuccess: invalidate,
  });

  const removeWatcher = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/watchers?issueId=${issueId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove watcher');
      return response.json();
    },
    onSuccess: invalidate,
  });

  const toggle = () => {
    if (isWatching) removeWatcher.mutate();
    else addWatcher.mutate();
  };

  return { isWatching, toggle, isMutating: addWatcher.isPending || removeWatcher.isPending };
}

/** Star = personal pin via /api/pinned-items (idempotent on href). */
function useIssueStar(issue: { id: string; key: string; title: string }) {
  const queryClient = useQueryClient();
  const issueHref = `/issues/${issue.id}`;

  const { data } = useQuery<PinnedItem[]>({
    queryKey: ['pinned-items'],
    queryFn: async () => {
      const response = await fetch('/api/pinned-items');
      if (!response.ok) throw new Error('Failed to fetch pinned items');
      const json = (await response.json()) as { items: PinnedItem[] };
      return json.items ?? [];
    },
  });

  // No per-entity lookup endpoint — derive starred state from the pin list.
  const existingPin = (data ?? []).find(
    (item) => (item.kind === 'issue' && item.entityId === issue.id) || item.href === issueHref
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pinned-items'] });

  const pin = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/pinned-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'issue',
          entityId: issue.id,
          title: `${issue.key} ${issue.title}`.trim().slice(0, 500),
          href: issueHref,
        }),
      });
      if (!response.ok) throw new Error('Failed to pin issue');
      return response.json();
    },
    onSuccess: invalidate,
  });

  const unpin = useMutation({
    mutationFn: async (pinId: string) => {
      const response = await fetch(`/api/pinned-items/${pinId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to unpin issue');
      return response.json();
    },
    onSuccess: invalidate,
  });

  const toggle = () => {
    if (existingPin) unpin.mutate(existingPin.id);
    else pin.mutate();
  };

  return { isStarred: !!existingPin, toggle, isMutating: pin.isPending || unpin.isPending };
}

export function IssueHeader({ issue }: IssueHeaderProps) {
  const t = useTranslations('issueHeader');
  const tTypes = useTranslations('issueTypes');
  const tExtra = useTranslations('issueHeaderExtra');
  const [copied, setCopied] = useState(false);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(issue.title);
  const updateIssue = useUpdateIssue();

  const star = useIssueStar(issue);
  const watch = useIssueWatch(issue.id);

  const knownType = issue.type in ISSUE_TYPE_CONFIG;
  const config = knownType ? ISSUE_TYPE_CONFIG[issue.type]! : ISSUE_TYPE_FALLBACK;
  const TypeIcon = config.icon;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditingTitle = () => {
    setTitleDraft(issue.title);
    setIsEditingTitle(true);
  };

  const cancelEditingTitle = () => {
    setTitleDraft(issue.title);
    setIsEditingTitle(false);
  };

  const commitTitle = () => {
    const next = titleDraft.trim();
    setIsEditingTitle(false);
    if (!next || next === issue.title) return;
    // useUpdateIssue applies the change optimistically and rolls back on error.
    updateIssue.mutate({ issueId: issue.id, data: { title: next } });
  };

  const { prefix: derivedPrefix, suffix: derivedSuffix } = splitIssueKey(issue.key ?? '');
  const projectPrefix = issue.projectKey ?? derivedPrefix ?? 'XXX';
  const issueSuffix =
    issue.number !== undefined && issue.number !== null
      ? String(issue.number)
      : derivedSuffix || issue.key;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <nav className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[12px]">
          <Inbox className="h-3.5 w-3.5" />
          <Link href="/issues" className="hover:text-foreground">
            {t('breadcrumb')}
          </Link>
          <ChevronRight className="h-3 w-3 opacity-60" />
          <span className="text-foreground font-medium">{projectPrefix}</span>
        </nav>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <TypeIcon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
            <span className="font-medium">{knownType ? tTypes(issue.type) : tTypes('issue')}</span>
          </span>
          <span className="text-foreground/80 font-mono">
            {projectPrefix}-{issueSuffix}
          </span>
          {issue.flagged ? (
            <span
              className="border-accent-amber/20 bg-accent-amber/10 text-accent-amber inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium"
              title={tExtra('flaggedHint')}
            >
              <Flag className="h-3 w-3 fill-current" />
              {tExtra('flagged')}
            </span>
          ) : null}
        </div>
        {isEditingTitle ? (
          <input
            autoFocus
            value={titleDraft}
            maxLength={500}
            aria-label={t('titleInputAria')}
            onChange={(event) => setTitleDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitTitle();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEditingTitle();
              }
            }}
            onBlur={commitTitle}
            className="text-foreground focus-visible:ring-ring -mx-1 w-full rounded-md border border-transparent bg-transparent px-1 text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2"
          />
        ) : (
          <div className="group/title flex items-start gap-1.5">
            <h1
              onClick={startEditingTitle}
              className="text-foreground cursor-text text-balance text-2xl font-semibold tracking-tight"
            >
              {issue.title}
            </h1>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('editTitle')}
              onClick={startEditingTitle}
              className="text-muted-foreground ease-snap hover:text-foreground mt-1 h-6 w-6 shrink-0 rounded-md p-0 opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/title:opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <PresenceAvatars issueId={issue.id} />

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'ease-snap gap-1.5 rounded-md transition-colors duration-150',
            star.isStarred && 'text-accent-amber'
          )}
          onClick={star.toggle}
          disabled={star.isMutating}
          aria-pressed={star.isStarred}
        >
          <Star className={cn('h-3.5 w-3.5', star.isStarred && 'fill-current')} />
          <span className="hidden sm:inline">{star.isStarred ? t('starred') : t('star')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'ease-snap gap-1.5 rounded-md transition-colors duration-150',
            watch.isWatching && 'text-accent-blue'
          )}
          onClick={watch.toggle}
          disabled={watch.isMutating}
          aria-pressed={watch.isWatching}
        >
          <Bell className={cn('h-3.5 w-3.5', watch.isWatching && 'fill-current')} />
          <span className="hidden sm:inline">{watch.isWatching ? t('watching') : t('watch')}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground ease-snap gap-1.5 rounded-md transition-colors duration-150"
          onClick={handleCopyLink}
        >
          {copied ? (
            <>
              <Check className="text-accent-emerald h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('copied')}</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('copyLink')}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
