'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Sparkles,
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
          <div className="space-y-6 max-w-[1400px] mx-auto p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentTeamId
                    ? 'Teamspace-scoped work, priorities, and activity for today'
                    : "Here's your project overview for today"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Insights
                </Button>
                <Link href="/my-issues">
                  <Button size="sm" className="gap-2">
                    <Target className="h-4 w-4" />
                    My Issues
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-4">
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
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base font-medium">My Issues</CardTitle>
                    </div>
                    <Link href="/my-issues">
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                        View All
                        <ArrowUpRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {!myIssues || myIssues.length === 0 ? (
                      <div className="text-center py-8">
                        <Inbox className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm font-medium">No issues assigned to you</p>
                        <p className="text-xs text-muted-foreground mt-1">Start by creating your first issue</p>
                      </div>
                    ) : (
                      myIssues.slice(0, 6).map((issue) => (
                        <IssueRow
                          key={issue.id}
                          issue={issue}
                          onClick={() => setSelectedIssueId(issue.id)}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              {currentOrganizationId && (
                <Card>
                  <ActivityFeed organizationId={currentOrganizationId} limit={10} />
                </Card>
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
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-semibold">{value}</p>
              <div className={cn(
                'flex items-center gap-0.5 text-xs',
                trendUp ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
              )}>
                {trendUp ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend}%
              </div>
            </div>
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IssueRow({ issue, onClick }: { issue: Issue; onClick: () => void }) {
  const priorityConfig: Record<string, { dot: string }> = {
    low: { dot: 'bg-slate-400' },
    medium: { dot: 'bg-blue-500' },
    high: { dot: 'bg-orange-500' },
    critical: { dot: 'bg-red-500' },
  };

  const config = priorityConfig[issue.priority] ?? priorityConfig.medium ?? { dot: 'bg-slate-400' };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors cursor-pointer hover:bg-accent"
    >
      {/* Priority dot */}
      <div className={cn('h-2 w-2 rounded-full shrink-0', config.dot)} />

      {/* Issue key */}
      <span className="text-xs font-mono text-muted-foreground shrink-0 w-20">
        {issue.key}
      </span>

      {/* Title */}
      <p className="text-sm truncate flex-1">
        {issue.title}
      </p>

      {/* Status badge */}
      <Badge
        variant="secondary"
        className="shrink-0 text-xs"
      >
        {issue.status.name}
      </Badge>

      {/* Time */}
      <span className="text-xs text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
      </span>
    </div>
  );
}
