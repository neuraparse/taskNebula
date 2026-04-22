'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Inbox, Loader2, Circle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/lib/hooks/use-organization';
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

function formatDue(due: string | null | undefined): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function IssueLine({ issue }: { issue: MyIssue }) {
  const statusCat = (issue.status?.category ?? '').toString().toLowerCase();
  const color = STATUS_COLOR[statusCat] ?? 'text-muted-foreground';
  const due = formatDue(issue.dueDate);
  return (
    <Link
      href={`/issues/${issue.id}`}
      className="row-interactive flex items-center gap-3 rounded-md px-2 py-2 min-h-[40px] text-left transition-all duration-150 ease-snap"
    >
      <Circle className={cn('h-3 w-3 shrink-0', color)} fill="currentColor" />
      <span className="text-xs font-mono text-muted-foreground shrink-0 w-16 truncate">
        {issue.key}
      </span>
      <p className="text-sm truncate flex-1 text-foreground">{issue.title}</p>
      {due && (
        <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">
          {due}
        </span>
      )}
      <Badge variant="outline" className="shrink-0 text-[10px]">
        {issue.project?.key ?? 'PRJ'}
      </Badge>
    </Link>
  );
}

export function YourWorkWidget() {
  const { data: session } = useSession();
  const { currentOrganizationId, currentTeamId } = useOrganization();
  const [tab, setTab] = useState<TabKey>('assigned');

  const { data, isLoading } = useQuery<MyIssue[]>({
    queryKey: ['your-work', session?.user?.id, currentOrganizationId, currentTeamId, tab],
    queryFn: async () => {
      const params = new URLSearchParams({ view: tab });
      if (currentOrganizationId) params.set('organizationId', currentOrganizationId);
      if (currentTeamId) params.set('teamId', currentTeamId);
      const response = await fetch(`/api/issues/my-issues?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch issues');
      const payload = await response.json();
      return payload.issues || [];
    },
    enabled: !!session?.user?.id,
  });

  const list = (data ?? []).slice(0, 7);

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-foreground">Your work</span>
        <Link
          href="/my-issues"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="mb-3">
          <TabsTrigger value="assigned">Assigned</TabsTrigger>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="subscribed">Subscribed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-7 w-7 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No items</p>
              <Link href={`/my-issues?view=${tab}`}>
                <Button variant="outline" size="sm">
                  Open my issues
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
