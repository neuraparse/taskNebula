'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { Inbox, Search, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface Issue {
  id: string;
  key: string;
  title: string;
  priority: string;
  statusId: string;
  projectId: string;
  estimate?: number;
  status: {
    name: string;
    category: string;
    color: string;
  };
  project: {
    key: string;
    name: string;
  };
  updatedAt?: string;
  createdAt?: string;
}

const priorityClass: Record<string, string> = {
  low: 'priority-low',
  medium: 'priority-medium',
  high: 'priority-high',
  critical: 'priority-critical',
};

const statusChipClass: Record<string, string> = {
  backlog: 'chip',
  todo: 'chip',
  in_progress: 'chip-blue',
  in_review: 'chip-violet',
  done: 'chip-emerald',
  blocked: 'chip-rose',
  pending: 'chip-amber',
};

type ScopeFilter = 'assigned' | 'watching' | 'reporting';

const scopeOptions: { value: ScopeFilter; label: string }[] = [
  { value: 'assigned', label: 'Assigned to me' },
  { value: 'watching', label: 'Watching' },
  { value: 'reporting', label: 'Reporting' },
];

function formatRelativeDate(input?: string): string {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.round(days / 365);
  return `${years}y`;
}

export function MyIssuesClient() {
  const { data: session } = useSession();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>('assigned');

  const { data: myIssues, isLoading } = useQuery<Issue[]>({
    queryKey: ['my-issues', session?.user?.id, scope],
    queryFn: async () => {
      // NOTE: API filter by scope is out-of-scope for this refactor; for now
      // Watching/Reporting reuse the same endpoint and are filtered client-side
      // when fields become available. Keeps server contract untouched.
      const response = await fetch('/api/issues/my-issues');
      if (!response.ok) throw new Error('Failed to fetch issues');
      const data = await response.json();
      return data.issues || [];
    },
    enabled: !!session?.user?.id,
  });

  const filteredIssues = (myIssues ?? []).filter((issue) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      issue.title.toLowerCase().includes(query) ||
      issue.key.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-background">
        {/* Header */}
        <div className="shrink-0 border-b border-border bg-background px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="kicker">Issues</span>
              <h1 className="text-2xl font-semibold tracking-tight">My Issues</h1>
              <p className="text-sm text-muted-foreground">
                {filteredIssues.length} issue{filteredIssues.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="relative w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
        </div>

        {/* Filter toolbar: single simple scope switch */}
        <div className="shrink-0 border-b border-border bg-background px-8 py-2.5">
          <div className="flex items-center gap-1 overflow-x-auto">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScope(option.value)}
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 ease-snap',
                  scope === option.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
          {filteredIssues.length === 0 ? (
            <div className="flex h-full items-center justify-center animate-fade-up">
              <div className="text-center">
                <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No issues match your search'
                    : scope === 'assigned'
                      ? 'No issues assigned to you yet'
                      : scope === 'watching'
                        ? 'You are not watching any issues'
                        : 'You have not reported any issues'}
                </p>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear search
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-fade-up">
              <div className="surface-card overflow-hidden rounded-lg">
                <ul className="stagger">
                  {filteredIssues.map((issue, idx) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      isLast={idx === filteredIssues.length - 1}
                      onClick={() => setSelectedIssueId(issue.id)}
                    />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => !open && setSelectedIssueId(null)}
        />
      )}
    </>
  );
}

function IssueRow({
  issue,
  isLast,
  onClick,
}: {
  issue: Issue;
  isLast: boolean;
  onClick: () => void;
}) {
  const pClass = priorityClass[issue.priority] ?? 'priority-medium';
  const chipClass = statusChipClass[issue.status.category] ?? 'chip';
  const updated = formatRelativeDate(issue.updatedAt ?? issue.createdAt);

  return (
    <li className={cn('relative', !isLast && 'border-b border-border/60')}>
      {/* Left-edge priority indicator */}
      <span
        aria-hidden
        className={cn('absolute left-0 top-0 bottom-0 w-0.5', pClass)}
      />
      <button
        type="button"
        onClick={onClick}
        className="row-interactive group flex min-h-[44px] w-full items-center gap-3 rounded-md pl-4 pr-4 text-left"
      >
        {/* Title (with inline key) */}
        <p className="flex-1 truncate text-sm text-foreground">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{issue.key}</span>
          {issue.title}
        </p>

        {/* Status chip */}
        <span className={cn('hidden shrink-0 sm:inline-flex', chipClass)}>
          {issue.status.name}
        </span>

        {/* Compact time */}
        {updated && (
          <span className="hidden w-10 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:inline">
            {updated}
          </span>
        )}
      </button>
    </li>
  );
}
