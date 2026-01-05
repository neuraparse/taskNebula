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
  const { currentOrganizationId } = useOrganization();

  // Fetch user's organizations to set default if not set
  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch('/api/organizations');
      if (!response.ok) throw new Error('Failed to fetch organizations');
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  // Set first organization as default if none selected
  const { setCurrentOrganization } = useOrganization();
  useEffect(() => {
    if (!currentOrganizationId && orgsData?.organizations?.length > 0) {
      setCurrentOrganization(orgsData.organizations[0].id);
    }
  }, [currentOrganizationId, orgsData, setCurrentOrganization]);

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

  // Calculate stats
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col bg-gradient-to-br from-background via-background to-muted/20">
        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="space-y-8 max-w-[1600px] mx-auto p-8">
            {/* Header */}
            <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="space-y-1">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}
                </h1>
                <p className="text-muted-foreground text-base">
                  Here's your project overview
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="gap-2 border-muted-foreground/20 hover:bg-accent/50 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-md">
                  <Sparkles className="h-4 w-4" />
                  AI Insights
                </Button>
                <Link href="/my-issues">
                  <Button className="gap-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                    <Target className="h-4 w-4" />
                    My Issues
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Grid - Compact */}
            <div className="grid gap-4 md:grid-cols-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Card className="border-muted-foreground/10 hover:border-blue-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 group backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Active</p>
                      <p className="text-3xl font-bold mt-2 tabular-nums">{stats.active}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/10 hover:border-green-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/5 group backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-3xl font-bold mt-2 tabular-nums">{stats.completed}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/10 hover:border-red-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/5 group backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Blocked</p>
                      <p className="text-3xl font-bold mt-2 tabular-nums">{stats.blocked}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted-foreground/10 hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5 group backdrop-blur">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Story Points</p>
                      <p className="text-3xl font-bold mt-2 tabular-nums">{stats.points}</p>
                    </div>
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm">
                      <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3 animate-in fade-in slide-in-from-bottom-6 duration-1000">
              {/* My Issues */}
              <Card className="border-muted-foreground/10 lg:col-span-2 backdrop-blur shadow-sm hover:shadow-md transition-all duration-300">
                <CardHeader className="pb-4 border-b border-muted-foreground/5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-semibold">My Issues</CardTitle>
                    <Link href="/my-issues">
                      <Button variant="ghost" size="sm" className="gap-1 hover:bg-accent/50 transition-colors">
                        View All
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    {!myIssues || myIssues.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                          <Inbox className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground text-sm">No issues assigned to you</p>
                      </div>
                    ) : (
                      myIssues.slice(0, 6).map((issue) => (
                        <div
                          key={issue.id}
                          onClick={() => setSelectedIssueId(issue.id)}
                          className="rounded-xl border border-muted-foreground/10 p-4 hover:bg-accent/30 hover:border-primary/30 transition-all duration-200 cursor-pointer group hover:shadow-md hover:scale-[1.01]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-semibold text-muted-foreground/80 group-hover:text-muted-foreground transition-colors">
                                  {issue.key}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-xs font-medium"
                                  style={{ borderColor: issue.status.color, color: issue.status.color }}
                                >
                                  {issue.status.name}
                                </Badge>
                              </div>
                              <p className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
                                {issue.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Updated {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
                              </p>
                            </div>
                            <PriorityBadge priority={issue.priority} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              {currentOrganizationId && (
                <ActivityFeed organizationId={currentOrganizationId} limit={10} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Issue Detail Modal */}
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

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    low: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-200 dark:border-red-800',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-semibold capitalize border",
        colors[priority as keyof typeof colors] || colors.medium
      )}
    >
      {priority}
    </Badge>
  );
}


