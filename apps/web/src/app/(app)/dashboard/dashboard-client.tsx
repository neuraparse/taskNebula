'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { useOrganization } from '@/lib/hooks/use-organization';
import {
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Target,
  BarChart3,
  Inbox,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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

  return (
    <>
      <div className="flex h-full flex-col bg-background">
        <div className="flex-1 overflow-auto">
          <div className="space-y-8 max-w-[1400px] mx-auto p-6 animate-fade-up">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <span className="kicker">Dashboard</span>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {currentTeamId
                    ? 'Teamspace-scoped work and priorities for today'
                    : "Your project overview for today"}
                </p>
              </div>
              <Link href="/my-issues">
                <Button size="sm" className="gap-2">
                  <Target className="h-4 w-4" />
                  My Issues
                </Button>
              </Link>
            </div>

            {/* Stats Grid */}
            <div className="stagger grid gap-4 md:grid-cols-4">
              <StatCard
                label="Active Issues"
                value={stats.active}
                icon={Clock}
                trend={12}
                trendUp={true}
              />
              <StatCard
                label="Completed"
                value={stats.completed}
                icon={CheckCircle2}
                trend={8}
                trendUp={true}
              />
              <StatCard
                label="Blocked"
                value={stats.blocked}
                icon={AlertCircle}
                trend={2}
                trendUp={false}
              />
              <StatCard
                label="Story Points"
                value={stats.points}
                icon={BarChart3}
                trend={15}
                trendUp={true}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* My Issues */}
              <div className="surface-card p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">My Issues</span>
                  </div>
                  <Link
                    href="/my-issues"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-0.5">
                  {!myIssues || myIssues.length === 0 ? (
                    <div className="text-center py-10">
                      <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No issues assigned to you</p>
                      <Link href="/my-issues">
                        <Button variant="outline" size="sm" className="mt-4">
                          Create issue
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    myIssues.slice(0, 5).map((issue) => (
                      <IssueRow
                        key={issue.id}
                        issue={issue}
                        onClick={() => setSelectedIssueId(issue.id)}
                      />
                    ))
                  )}
                </div>
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

function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendUp,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  trend: number;
  trendUp: boolean;
}) {
  return (
    <div className="surface-card surface-card-hover p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          <span className={cn(
            'chip flex items-center gap-1 w-fit',
            trendUp
              ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20'
              : 'bg-accent-rose/10 text-accent-rose border-accent-rose/20'
          )}>
            {trendUp ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend}%
          </span>
        </div>
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
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

  const cls = priorityClass[issue.priority] ?? 'priority-medium';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 min-h-[40px] text-left transition-colors cursor-pointer hover:bg-accent/50"
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', cls)} />

      <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">
        {issue.key}
      </span>

      <p className="text-sm truncate flex-1 text-foreground">
        {issue.title}
      </p>

      <span className="chip shrink-0 hidden sm:inline-flex">
        {issue.status.name}
      </span>
    </button>
  );
}
