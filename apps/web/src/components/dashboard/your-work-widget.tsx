'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Inbox, Loader2, Circle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/lib/hooks/use-organization';
import { isApiPermissionError, throwApiResponseError } from '@/lib/client-api-errors';
import { cn } from '@/lib/utils';

type TabKey = 'assigned' | 'created' | 'subscribed';

interface MyIssue {
  id: string;
  key: string;
  title: string;
  priority: string;
  statusId: string;
  projectId: string;
  estimate?: number;
  dueDate?: string | null;
  status: { name: string; category: string; color: string };
  project: { key: string; name: string };
}

const STATUS_COLOR: Record<string, string> = {
  backlog: 'text-muted-foreground',
  todo: 'text-muted-foreground',
  in_progress: 'text-accent-blue',
  blocked: 'text-accent-rose',
  done: 'text-accent-emerald',
};

type WorkFormatter = ReturnType<typeof useFormatter>;

function formatDue(due: string | null | undefined, formatter: WorkFormatter): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return formatter.dateTime(d, { month: 'short', day: 'numeric' });
}

function IssueLine({ issue }: { issue: MyIssue }) {
  const formatter = useFormatter();
  const statusCat = (issue.status?.category ?? '').toString().toLowerCase();
  const color = STATUS_COLOR[statusCat] ?? 'text-muted-foreground';
  const due = formatDue(issue.dueDate, formatter);
  return (
    <Link
      href={`/issues/${issue.id}`}
      className="row-interactive ease-snap flex min-h-[40px] items-center gap-3 rounded-md px-2 py-2 text-left transition-all duration-150"
    >
      <Circle className={cn('h-3 w-3 shrink-0', color)} fill="currentColor" />
      <span className="text-muted-foreground w-16 shrink-0 truncate font-mono text-xs">
        {issue.key}
      </span>
      <p className="text-foreground flex-1 truncate text-sm">{issue.title}</p>
      {due && (
        <span className="text-muted-foreground hidden shrink-0 text-[11px] sm:inline">{due}</span>
      )}
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {issue.project?.key ?? 'PRJ'}
      </Badge>
    </Link>
  );
}

export function YourWorkWidget() {
  const t = useTranslations('dashboardExtra');
  const tActions = useTranslations('actions');
  const tHome = useTranslations('pagesHome');
  const tIssues = useTranslations('issuesViews');
  const { data: session } = useSession();
  const { currentOrganizationId, currentTeamId } = useOrganization();
  const [tab, setTab] = useState<TabKey>('assigned');

  const { data, error, isLoading } = useQuery<MyIssue[]>({
    queryKey: ['your-work', session?.user?.id, currentOrganizationId, currentTeamId, tab],
    queryFn: async () => {
      const params = new URLSearchParams({ view: tab });
      if (currentOrganizationId) params.set('organizationId', currentOrganizationId);
      if (currentTeamId) params.set('teamId', currentTeamId);
      const response = await fetch(`/api/issues/my-issues?${params.toString()}`);
      if (!response.ok) await throwApiResponseError(response, tIssues('loadFailed'));
      const payload = await response.json();
      return payload.issues || [];
    },
    enabled: !!session?.user?.id,
  });

  const list = (data ?? []).slice(0, 7);
  const errorMessage = error
    ? isApiPermissionError(error)
      ? tHome('toast_access_denied_description')
      : tIssues('loadFailed')
    : null;

  return (
    <div className="surface-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          {t('your_work.heading')}
        </span>
        <Link
          href="/my-issues"
          className="text-muted-foreground hover:text-foreground ease-snap inline-flex items-center gap-1 text-xs transition-all duration-150"
        >
          {tActions('view_all')}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="mb-3 h-8">
          <TabsTrigger value="assigned">{t('your_work.tab_assigned')}</TabsTrigger>
          <TabsTrigger value="created">{t('your_work.tab_created')}</TabsTrigger>
          <TabsTrigger value="subscribed">{t('your_work.tab_subscribed')}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="text-muted-foreground mb-2 h-7 w-7" />
              <p className="text-foreground mb-1 text-sm font-medium">{tIssues('loadFailed')}</p>
              <p className="text-muted-foreground text-sm">{errorMessage}</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="text-muted-foreground mb-2 h-7 w-7" />
              <p className="text-muted-foreground mb-3 text-sm">{t('empty_no_items')}</p>
              <Link href={`/my-issues?view=${tab}`}>
                <Button variant="outline" size="sm">
                  {t('your_work.open_my_issues')}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-0.5">
              {list.map((issue) => (
                <IssueLine key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
