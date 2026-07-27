'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MetricStrip, type MetricStripItem } from '@/components/ui/metric-strip';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { UpcomingDeadlinesWidget } from '@/components/dashboard/upcoming-deadlines-widget';
import { PinnedItemsWidget } from '@/components/dashboard/pinned-items-widget';
import { CatchMeUpBanner } from '@/components/dashboard/catch-me-up-banner';
import { StandupWidget } from '@/components/dashboard/standup-widget';
import { DeliveryAnalysis } from '@/components/dashboard/delivery-analysis';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjects } from '@/lib/hooks/use-projects';
import { ArrowUpRight, Target, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { DashboardLoadingShell } from './dashboard-loading-shell';

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

const STATUS_ACTION_ORDER: Record<string, number> = {
  blocked: 0,
  in_progress: 1,
  todo: 2,
  backlog: 3,
};

const PRIORITY_ACTION_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function compareActionableIssues(left: Issue, right: Issue): number {
  const statusDelta =
    (STATUS_ACTION_ORDER[left.status.category] ?? 4) -
    (STATUS_ACTION_ORDER[right.status.category] ?? 4);
  if (statusDelta !== 0) return statusDelta;

  const priorityDelta =
    (PRIORITY_ACTION_ORDER[left.priority] ?? 4) - (PRIORITY_ACTION_ORDER[right.priority] ?? 4);
  if (priorityDelta !== 0) return priorityDelta;

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function DashboardClient() {
  const { data: session } = useSession();
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const { currentOrganizationId, currentTeamId } = useOrganization();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const tDash = useTranslations('dashboard');
  const tActions = useTranslations('actions');
  const tNav = useTranslations('nav');
  const t = useTranslations('pagesHome');
  const errorT = useTranslations('componentErrors.dashboard');

  // Surface server-side permission redirects (e.g. /settings/organization without perms)
  // and the post-verify success landing (/dashboard?verified=1).
  useEffect(() => {
    const error = searchParams.get('error');
    const verified = searchParams.get('verified');

    if (error === 'insufficient-permission') {
      toast({
        title: t('toast_access_denied_title'),
        description: t('toast_access_denied_description'),
        variant: 'destructive',
      });
    } else if (verified === '1') {
      toast({
        title: t('toast_verified_title'),
        description: t('toast_verified_description'),
      });
    } else {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete('error');
    next.delete('verified');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const { data: projectsForCreate } = useProjects({
    organizationId: currentOrganizationId,
    teamId: currentTeamId,
  });
  const firstProjectId = projectsForCreate?.[0]?.id ?? null;

  const { data: orgsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const response = await fetch('/api/organizations');
      if (!response.ok) throw new Error(errorT('fetchOrganizations'));
      return response.json();
    },
    enabled: !!session?.user?.id,
  });

  const { setCurrentOrganization } = useOrganization();
  const firstOrganizationId = orgsData?.organizations?.[0]?.id ?? null;
  useEffect(() => {
    if (!currentOrganizationId && firstOrganizationId) {
      setCurrentOrganization(firstOrganizationId);
    }
  }, [currentOrganizationId, firstOrganizationId, setCurrentOrganization]);

  const { data: myIssues, isLoading } = useQuery<Issue[]>({
    queryKey: ['my-issues', session?.user?.id, currentOrganizationId, currentTeamId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentOrganizationId) params.set('organizationId', currentOrganizationId);
      if (currentTeamId) params.set('teamId', currentTeamId);

      const response = await fetch(
        `/api/issues/my-issues${params.size > 0 ? `?${params.toString()}` : ''}`
      );
      if (!response.ok) throw new Error(errorT('fetchIssues'));
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

    const completed = myIssues.filter((issue) => issue.status.category === 'done').length;

    const blocked = myIssues.filter((issue) => issue.status.category === 'blocked').length;

    const points = myIssues
      .filter((issue) => issue.status.category === 'in_progress')
      .reduce((sum, issue) => sum + (issue.estimate || 0), 0);

    return { active, completed, blocked, points };
  }, [myIssues]);

  const actionableIssues = useMemo(
    () =>
      (myIssues ?? [])
        .filter((issue) => issue.status.category !== 'done')
        .sort(compareActionableIssues),
    [myIssues]
  );

  if (isLoading) {
    return <DashboardLoadingShell />;
  }

  const firstName = session?.user?.name?.split(' ')[0] || t('greeting_fallback_name');
  const metrics: MetricStripItem[] = [
    { id: 'active', label: tDash('stat_active'), value: stats.active },
    { id: 'blocked', label: tDash('stat_blocked'), value: stats.blocked },
    { id: 'points', label: tDash('stat_story_points'), value: stats.points },
    { id: 'completed', label: tDash('stat_completed'), value: stats.completed },
  ];

  return (
    <>
      <PageFrame className="dashboard-carbon">
        <PageHeader
          className="animate-fade-up"
          kicker={tDash('kicker')}
          title={tDash('welcome_back', { name: firstName })}
          description={currentTeamId ? tDash('subtitle_team') : tDash('subtitle_personal')}
          actions={
            <Button asChild size="sm" className="w-full sm:w-auto">
              <Link href="/my-issues">
                <Target className="h-4 w-4" />
                {tNav('my_issues')}
              </Link>
            </Button>
          }
        />

        <MetricStrip items={metrics} />

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <section
              aria-labelledby="dashboard-action-queue"
              className="surface-card animate-fade-up min-w-0 overflow-hidden shadow-none"
            >
              <div className="border-border flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2.5">
                <h2
                  id="dashboard-action-queue"
                  className="text-foreground min-w-0 truncate text-sm font-semibold"
                >
                  {tDash('my_issues_heading')}
                </h2>
                <Link
                  href="/my-issues"
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs transition-colors duration-150"
                >
                  {tActions('view_all')}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

              {actionableIssues.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <Inbox className="text-muted-foreground mb-3 h-7 w-7" />
                  <p className="text-muted-foreground mb-4 text-sm">{tDash('all_caught_up')}</p>
                  {firstProjectId ? (
                    <Button variant="outline" size="sm" onClick={() => setIsCreateIssueOpen(true)}>
                      {tActions('create_issue')}
                    </Button>
                  ) : (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/projects">{tActions('create_project')}</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-border divide-y px-2 py-2">
                  {actionableIssues.slice(0, 7).map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      onClick={() => setSelectedIssueId(issue.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <UpcomingDeadlinesWidget />
          </div>

          <aside className="min-w-0 space-y-4">
            <CatchMeUpBanner />
            <StandupWidget />
            <PinnedItemsWidget />
            {currentOrganizationId ? (
              <ActivityFeed organizationId={currentOrganizationId} limit={6} />
            ) : null}
          </aside>
        </div>

        <DeliveryAnalysis organizationId={currentOrganizationId} projectId={firstProjectId} />
      </PageFrame>

      {selectedIssueId && (
        <IssueDetailModal
          issueId={selectedIssueId}
          open={!!selectedIssueId}
          onOpenChange={(open) => !open && setSelectedIssueId(null)}
        />
      )}

      {firstProjectId && (
        <CreateIssueModal
          open={isCreateIssueOpen}
          onOpenChange={setIsCreateIssueOpen}
          projectId={firstProjectId}
        />
      )}
    </>
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
      className="row-interactive hover:border-border-strong flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 rounded-none border border-transparent py-2.5 pl-2 pr-3 text-left transition-colors duration-150 sm:gap-3"
    >
      <span className={cn('priority-indicator h-6 shrink-0', priorityCls)} />

      <span className="text-muted-foreground w-16 shrink-0 truncate font-mono text-xs sm:w-20">
        {issue.key}
      </span>

      <p className="text-foreground min-w-0 flex-1 truncate text-sm">{issue.title}</p>

      <span className="text-muted-foreground hidden shrink-0 items-center gap-1.5 text-xs sm:inline-flex">
        <span className={cn('status-dot', statusCls)} />
        {issue.status.name}
      </span>
    </button>
  );
}
