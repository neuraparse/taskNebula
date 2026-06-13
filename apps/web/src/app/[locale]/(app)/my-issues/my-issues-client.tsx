'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

type ScopeFilter = 'assigned' | 'created' | 'subscribed' | 'mentioned';

const scopeOptions: { value: ScopeFilter; labelKey: string }[] = [
  { value: 'assigned', labelKey: 'assigned_to_me' },
  { value: 'created', labelKey: 'created_by_me' },
  { value: 'subscribed', labelKey: 'subscribed' },
  { value: 'mentioned', labelKey: 'mentioned' },
];

function parseScope(value: string | null): ScopeFilter {
  if (value === 'created' || value === 'subscribed' || value === 'mentioned') {
    return value;
  }
  return 'assigned';
}

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
  const t = useTranslations('pagesHome');
  const tNav = useTranslations('nav');
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialScope = parseScope(searchParams.get('view'));
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<ScopeFilter>(initialScope);

  useEffect(() => {
    setScope(parseScope(searchParams.get('view')));
  }, [searchParams]);

  const handleScopeChange = (next: ScopeFilter) => {
    setScope(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const { data: myIssues, isLoading } = useQuery<Issue[]>({
    queryKey: ['my-issues', session?.user?.id, scope],
    queryFn: async () => {
      const params = new URLSearchParams({ view: scope });
      const response = await fetch(`/api/issues/my-issues?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch issues');
      const data = await response.json();
      return data.issues || [];
    },
    enabled: !!session?.user?.id,
  });

  const filteredIssues = (myIssues ?? []).filter((issue) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return issue.title.toLowerCase().includes(query) || issue.key.toLowerCase().includes(query);
  });

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-background flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="border-border bg-background shrink-0 border-b px-8 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="space-y-1">
              <span className="kicker">{t('my_issues_kicker')}</span>
              <h1 className="whitespace-nowrap text-2xl font-semibold tracking-tight">
                {tNav('my_issues')}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t('my_issues_count', { count: filteredIssues.length })}
              </p>
            </div>
            <div className="relative w-full max-w-full md:w-72 md:shrink-0">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder={t('my_issues_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
        </div>

        {/* Filter toolbar: single simple scope switch */}
        <div className="border-border bg-background shrink-0 border-b px-8 py-2.5">
          <div className="scrollbar-none flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            {scopeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleScopeChange(option.value)}
                className={cn(
                  'ease-snap shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150',
                  scope === option.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                {tNav(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto px-8 py-6">
          {filteredIssues.length === 0 ? (
            <div className="animate-fade-up flex h-full items-center justify-center">
              <div className="text-center">
                <Inbox className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery
                    ? t('my_issues_empty_search')
                    : scope === 'assigned'
                      ? t('my_issues_empty_assigned')
                      : scope === 'created'
                        ? t('my_issues_empty_created')
                        : scope === 'subscribed'
                          ? t('my_issues_empty_subscribed')
                          : t('my_issues_empty_mentioned')}
                </p>
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3"
                    onClick={() => setSearchQuery('')}
                  >
                    {t('my_issues_clear_search')}
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
    <li className={cn('relative', !isLast && 'border-border/60 border-b')}>
      {/* Left-edge priority indicator */}
      <span aria-hidden className={cn('absolute bottom-0 left-0 top-0 w-0.5', pClass)} />
      <button
        type="button"
        onClick={onClick}
        className="row-interactive group flex min-h-[44px] w-full items-center gap-3 rounded-md pl-4 pr-4 text-left"
      >
        {/* Title (with inline key) */}
        <p className="text-foreground flex-1 truncate text-sm">
          <span className="text-muted-foreground mr-2 font-mono text-xs">{issue.key}</span>
          {issue.title}
        </p>

        {/* Status chip */}
        <span className={cn('hidden shrink-0 sm:inline-flex', chipClass)}>{issue.status.name}</span>

        {/* Compact time */}
        {updated && (
          <span className="text-muted-foreground hidden w-10 shrink-0 text-right font-mono text-[11px] sm:inline">
            {updated}
          </span>
        )}
      </button>
    </li>
  );
}
