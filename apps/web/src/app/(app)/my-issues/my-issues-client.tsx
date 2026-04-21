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

const categoryStatusClass: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  in_review: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
  done: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
  blocked: 'bg-accent-rose/10 text-accent-rose border-accent-rose/20',
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
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border bg-background px-6 py-5">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
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
        <div className="border-b border-border bg-background px-6 py-2.5">
          <div className="mx-auto flex max-w-[1400px] items-center gap-1 overflow-x-auto">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setScope(option.value)}
                className={cn(
                  'shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-smooth',
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
        <div className="flex-1 overflow-auto p-6">
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
            <div className="mx-auto max-w-[1400px] animate-fade-up">
              <div className="surface-card overflow-hidden">
                {filteredIssues.map((issue, idx) => (
                  <IssueRow
                    key={issue.id}
                    issue={issue}
                    isLast={idx === filteredIssues.length - 1}
                    onClick={() => setSelectedIssueId(issue.id)}
                  />
                ))}
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
  const statusClass =
    categoryStatusClass[issue.status.category] ??
    'bg-muted text-muted-foreground border-border';
  const updated = formatRelativeDate(issue.updatedAt ?? issue.createdAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[44px] w-full items-center gap-3 px-4 text-left transition-colors duration-200 ease-smooth hover:bg-accent/50',
        !isLast && 'border-b border-border'
      )}
    >
      {/* 1. Priority stripe */}
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', pClass)} aria-hidden />

      {/* 2. Title (with inline key) */}
      <p className="flex-1 truncate text-sm text-foreground">
        <span className="mr-2 font-mono text-xs text-muted-foreground">{issue.key}</span>
        {issue.title}
      </p>

      {/* 3. Status chip */}
      <span
        className={cn(
          'hidden shrink-0 rounded-full border px-2 py-0.5 text-[11px] sm:inline-flex',
          statusClass
        )}
      >
        {issue.status.name}
      </span>

      {/* 4. Compact time */}
      {updated && (
        <span className="hidden w-10 shrink-0 text-right font-mono text-[11px] text-muted-foreground sm:inline">
          {updated}
        </span>
      )}
    </button>
  );
}
