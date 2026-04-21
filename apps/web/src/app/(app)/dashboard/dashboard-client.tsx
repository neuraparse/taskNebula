'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { useOrganization } from '@/lib/hooks/use-organization';
import {
  ArrowUpRight,
  Loader2,
  Target,
  Inbox,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
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
  createdAt: string;
  updatedAt: string;
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

export function DashboardClient() {
  const { data: session } = useSession();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const { currentOrganizationId, currentTeamId } = useOrganization();

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch('/api/organizations');
      if (!response.ok) throw new Error('Failed to fetch organizations');
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const { setCurrentOrganization } = useOrganization();
  useEffect(() => {
    if (!currentOrganizationId && orgsData?.organizations?.length > 0) {
      setCurrentOrganization(orgsData.organizations[0].id);
    }
  }, [currentOrganizationId, orgsData, setCurrentOrganization]);

  const { data: myIssues, isLoading } = useQuery<Issue[]>({
    queryKey: ['my-issues', session?.user?.id, currentOrganizationId, currentTeamId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentOrganizationId) params.set('organizationId', currentOrganizationId);
      if (currentTeamId) params.set('teamId', currentTeamId);

      const response = await fetch(`/api/issues/my-issues${params.size > 0 ? `?${params.toString()}` : ''}`);
      if (!response.ok) throw new Error('Failed to fetch issues');
      const data = await response.json();
      return data.issues || [];
    },
    enabled: !!session?.user?.id,
  });

  const stats = useMemo(() => {
    if (!myIssues) return { active: 0, completed: 0, blocked: 0, points: 0 };

    const active = myIssues.filter(
      (issue) => issue.status.category === 'in_progress' || issue.status.category === 'backlog'
    ).length;

    const completed = myIssues.filter(
      (issue) => issue.status.category === 'done'
    ).length;

    const blocked = myIssues.filter(
      (issue) => issue.status.category === 'blocked'
    ).length;

    const points = myIssues
      .filter((issue) => issue.status.category === 'in_progress')
      .reduce((sum, issue) => sum + (issue.estimate || 0), 0);

    return { active, completed, blocked, points };
  }, [myIssues]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  return (
    <>
      <div className="flex h-full flex-col bg-background">
        <div className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-6 space-y-8">

            {/* Greeting */}
            <div className="flex items-end justify-between gap-4 animate-fade-up">
              <div className="space-y-1">
                <span className="kicker">Dashboard</span>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
                  Welcome back, {firstName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {currentTeamId
                    ? 'Teamspace-scoped work and priorities for today.'
                    : 'Your project overview for today.'}
                </p>
              </div>
              <Link href="/my-issues">
                <Button size="sm" className="gap-2">
                  <Target className="h-4 w-4" />
                  My Issues
                </Button>
              </Link>
            </div>

            {/* KPI Summary Row */}
            <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Active"
                value={stats.active}
                trend={12}
                trendUp
                emphasized
              />
              <StatTile
                label="Completed"
                value={stats.completed}
                trend={8}
                trendUp
              />
              <StatTile
                label="Blocked"
                value={stats.blocked}
                trend={2}
                trendUp={false}
              />
              <StatTile
                label="Story Points"
                value={stats.points}
                trend={15}
                trendUp
              />
            </div>

            {/* Main Content */}
            <div className="stagger grid gap-6 lg:grid-cols-3">
              {/* My Issues */}
              <div className="surface-card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">My Issues</span>
                  </div>
                  <Link
                    href="/my-issues"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                {!myIssues || myIssues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      You&apos;re all caught up — nothing assigned right now.
                    </p>
                    <Link href="/my-issues">
                      <Button variant="outline" size="sm">
                        Create issue
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {myIssues.slice(0, 5).map((issue) => (
                      <IssueRow
                        key={issue.id}
                        issue={issue}
                        onClick={() => setSelectedIssueId(issue.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              {currentOrganizationId && (
                <div className="surface-card p-6">
                  <ActivityFeed organizationId={currentOrganizationId} limit={5} />
                </div>
              )}
            </div>
          </div>
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

function StatTile({
  label,
  value,
  trend,
  trendUp,
  emphasized = false,
}: {
  label: string;
  value: number;
  trend: number;
  trendUp: boolean;
  emphasized?: boolean;
}) {
  return (
    <div className="surface-card surface-card-hover p-5 transition-all duration-200 ease-smooth hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cn(
            'text-3xl font-semibold tracking-tight',
            emphasized ? 'text-gradient-primary' : 'text-foreground'
          )}
        >
          {value}
        </p>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-xs font-medium',
            trendUp ? 'text-accent-emerald' : 'text-accent-rose'
          )}
        >
          {trendUp ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {trend}%
        </span>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function IssueRow({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const priorityClass: Record<string, string> = {
    low: 'priority-low',
    medium: 'priority-medium',
    high: 'priority-high',
    critical: 'priority-critical',
  };

  const statusDotClass: Record<string, string> = {
    in_progress: 'status-live',
    blocked: 'status-danger',
    backlog: 'status-idle',
    done: 'status-live',
  };

  const priorityCls = priorityClass[issue.priority] ?? 'priority-medium';
  const statusCls = statusDotClass[issue.status.category] ?? 'status-idle';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-md pl-2 pr-3 py-2.5 min-h-[40px] text-left transition-all duration-200 ease-smooth cursor-pointer hover:bg-accent/50"
    >
      <span className={cn('priority-indicator h-6 shrink-0', priorityCls)} />

      <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">
        {issue.key}
      </span>

      <p className="text-sm truncate flex-1 text-foreground">
        {issue.title}
      </p>

      <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
        <span className={cn('status-dot', statusCls)} />
        {issue.status.name}
      </span>
    </button>
  );
}
