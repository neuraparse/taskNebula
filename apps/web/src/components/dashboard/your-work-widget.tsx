'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowUpRight, Inbox, Loader2, Circle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIssues, type Issue } from '@/lib/hooks/use-issues';
import { cn } from '@/lib/utils';

type TabKey = 'assigned' | 'created' | 'subscribed';

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

function IssueLine({ issue }: { issue: Issue }) {
  const statusCat = (issue.status ?? '').toString().toLowerCase();
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
        {issue.projectId ? issue.projectId.slice(0, 4).toUpperCase() : 'PRJ'}
      </Badge>
    </Link>
  );
}

const PLACEHOLDER_ISSUES: Issue[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `stub-${i}`,
  key: `TN-${100 + i}`,
  title: `Placeholder issue ${i + 1}`,
  description: null,
  type: 'task',
  status: 'todo',
  priority: 'medium',
  assigneeId: null,
  reporterId: 'stub',
  organizationId: 'stub',
  projectId: 'stub',
  sprintId: null,
  estimate: null,
  dueDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

export function YourWorkWidget() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<TabKey>('assigned');

  const assignedQ = useIssues({ assigneeId: session?.user?.id });
  // Created/Subscribed not supported by hook — stubbed to same list filtered client-side.
  const allQ = useIssues({});

  const list: Issue[] = useMemo(() => {
    if (tab === 'assigned') {
      if (assignedQ.data && assignedQ.data.length > 0) {
        return assignedQ.data.slice(0, 7);
      }
      return assignedQ.isLoading ? [] : PLACEHOLDER_ISSUES;
    }
    if (tab === 'created') {
      const mine = (allQ.data ?? []).filter(
        (i) => i.reporterId === session?.user?.id
      );
      return mine.length > 0 ? mine.slice(0, 7) : PLACEHOLDER_ISSUES;
    }
    // subscribed: no backend, stub
    return PLACEHOLDER_ISSUES;
  }, [tab, assignedQ.data, assignedQ.isLoading, allQ.data, session?.user?.id]);

  const loading = tab === 'assigned' ? assignedQ.isLoading : allQ.isLoading;

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
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="h-7 w-7 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">No items</p>
              <Link href="/my-issues">
                <Button variant="outline" size="sm">
                  Create issue
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
