'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import {
  Inbox,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutGrid,
} from 'lucide-react';
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
}

const categoryMeta: Record<string, { icon: React.ElementType; label: string }> = {
  backlog: { icon: Inbox, label: 'Backlog' },
  in_progress: { icon: Clock, label: 'In Progress' },
  in_review: { icon: CheckCircle2, label: 'In Review' },
  done: { icon: CheckCircle2, label: 'Done' },
  blocked: { icon: XCircle, label: 'Blocked' },
};

const categoryStatusClass: Record<string, string> = {
  backlog: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
  in_review: 'bg-accent-violet/10 text-accent-violet border-accent-violet/20',
  done: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
  blocked: 'bg-accent-rose/10 text-accent-rose border-accent-rose/20',
};

const priorityClass: Record<string, string> = {
  low: 'priority-low',
  medium: 'priority-medium',
  high: 'priority-high',
  critical: 'priority-critical',
};

export function MyIssuesClient() {
  const { data: session } = useSession();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const { data: myIssues, isLoading } = useQuery<Issue[]>({
    queryKey: ['my-issues', session?.user?.id],
    queryFn: async () => {
      const response = await fetch('/api/issues/my-issues');
      if (!response.ok) throw new Error('Failed to fetch issues');
      const data = await response.json();
      return data.issues || [];
    },
    enabled: !!session?.user?.id,
  });

  const filteredIssues = myIssues?.filter((issue) => {
    const matchesSearch = !searchQuery || (() => {
      const query = searchQuery.toLowerCase();
      return (
        issue.title.toLowerCase().includes(query) ||
        issue.key.toLowerCase().includes(query)
      );
    })();
    const matchesFilter = !activeFilter || issue.status.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const groupedIssues = {
    in_progress: filteredIssues?.filter((i) => i.status.category === 'in_progress') || [],
    in_review: filteredIssues?.filter((i) => i.status.category === 'in_review') || [],
    blocked: filteredIssues?.filter((i) => i.status.category === 'blocked') || [],
    backlog: filteredIssues?.filter((i) => i.status.category === 'backlog') || [],
    done: filteredIssues?.filter((i) => i.status.category === 'done') || [],
  };

  const categories = Object.keys(groupedIssues) as (keyof typeof groupedIssues)[];

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
        <div className="border-b border-border bg-background px-6 py-4">
          <div className="flex items-center justify-between gap-4 max-w-[1400px] mx-auto">
            <div className="space-y-0.5">
              <span className="kicker">Issues</span>
              <h1 className="text-2xl font-semibold tracking-tight">My Issues</h1>
              <p className="text-sm text-muted-foreground">
                {filteredIssues?.length || 0} issue{filteredIssues?.length !== 1 ? 's' : ''} assigned to you
              </p>
            </div>
            <div className="relative w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div className="border-b border-border bg-background px-6 py-2.5">
          <div className="flex items-center gap-2 max-w-[1400px] mx-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveFilter(null)}
              className={cn(
                'chip transition-colors shrink-0',
                activeFilter === null
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'hover:bg-accent/50'
              )}
            >
              All
            </button>
            {categories.map((cat) => {
              const count = (myIssues?.filter((i) => i.status.category === cat) || []).length;
              if (count === 0) return null;
              const meta = categoryMeta[cat];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                  className={cn(
                    'chip flex items-center gap-1.5 transition-colors shrink-0',
                    activeFilter === cat
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'hover:bg-accent/50'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {meta.label}
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!filteredIssues || filteredIssues.length === 0 ? (
            <div className="flex h-full items-center justify-center animate-fade-up">
              <div className="text-center">
                <Inbox className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No issues match your search' : 'No issues assigned to you yet'}
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
            <div className="space-y-8 max-w-[1400px] mx-auto animate-fade-up">
              {categories.map((category) => {
                const issues = groupedIssues[category];
                if (issues.length === 0) return null;
                const meta = categoryMeta[category];
                if (!meta) return null;
                const Icon = meta.icon;

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{meta.label}</span>
                      <span className="chip ml-1">{issues.length}</span>
                    </div>
                    <div className="surface-card">
                      {issues.map((issue, idx) => (
                        <IssueRow
                          key={issue.id}
                          issue={issue}
                          isLast={idx === issues.length - 1}
                          onClick={() => setSelectedIssueId(issue.id)}
                          statusClass={categoryStatusClass[category] ?? ''}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
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
  statusClass,
}: {
  issue: Issue;
  isLast: boolean;
  onClick: () => void;
  statusClass: string;
}) {
  const pClass = priorityClass[issue.priority] ?? 'priority-medium';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 min-h-[42px] text-left transition-colors hover:bg-accent/50',
        !isLast && 'border-b border-border'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', pClass)} />

      <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">
        {issue.key}
      </span>

      <p className="text-sm truncate flex-1 text-foreground">
        {issue.title}
      </p>

      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <LayoutGrid className="h-3 w-3" />
          {issue.project.name}
        </span>
        {issue.estimate && (
          <span className="chip">{issue.estimate} pts</span>
        )}
        <span className={cn('chip', statusClass)}>
          {issue.status.name}
        </span>
      </div>
    </button>
  );
}
