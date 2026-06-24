'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { YourWorkWidget } from '@/components/dashboard/your-work-widget';
import { UpcomingDeadlinesWidget } from '@/components/dashboard/upcoming-deadlines-widget';
import { PinnedItemsWidget } from '@/components/dashboard/pinned-items-widget';
import { CatchMeUpBanner } from '@/components/dashboard/catch-me-up-banner';
import { StandupWidget } from '@/components/dashboard/standup-widget';
import { AnalyticsBento } from '@/components/dashboard/analytics-bento';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  ArrowUpRight,
  Target,
  Inbox,
  Activity,
  CheckCircle2,
  AlertOctagon,
  Gauge,
} from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
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

type AccentHue = 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';

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

  if (isLoading) {
    return <DashboardLoadingShell />;
  }

  const firstName = session?.user?.name?.split(' ')[0] || t('greeting_fallback_name');

  return (
    <>
      <div className="dashboard-carbon bg-background flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto w-full min-w-0 max-w-[1680px] space-y-3 p-3 sm:p-4 lg:p-5">
            <CatchMeUpBanner />

            {/* Greeting */}
            <div className="surface-card animate-fade-up border-t-primary flex flex-col border-t-2 shadow-none sm:flex-row sm:items-stretch sm:justify-between">
              <div className="min-w-0 space-y-1 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <span className="kicker">{tDash('kicker')}</span>
                  <span className="live-pill">{tDash('live')}</span>
                </div>
                <h1 className="text-foreground text-balance text-2xl font-[400] leading-tight tracking-normal sm:text-[28px]">
                  {tDash('welcome_back', { name: firstName })}
                </h1>
                <p className="text-muted-foreground max-w-2xl text-sm">
                  {currentTeamId ? tDash('subtitle_team') : tDash('subtitle_personal')}
                </p>
              </div>
              <div className="border-border flex items-center border-t p-4 sm:border-l sm:border-t-0 sm:p-5">
                <Link href="/my-issues" className="w-full sm:w-auto">
                  <Button size="sm" className="w-full gap-2 rounded-none sm:w-auto">
                    <Target className="h-4 w-4" />
                    {tNav('my_issues')}
                  </Button>
                </Link>
              </div>
            </div>

            {/* KPI Summary Row */}
            <div className="stagger grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label={tDash('stat_active')}
                value={stats.active}
                hue="blue"
                icon={Activity}
              />
              <StatTile
                label={tDash('stat_completed')}
                value={stats.completed}
                hue="emerald"
                icon={CheckCircle2}
              />
              <StatTile
                label={tDash('stat_blocked')}
                value={stats.blocked}
                hue="rose"
                icon={AlertOctagon}
              />
              <StatTile
                label={tDash('stat_story_points')}
                value={stats.points}
                hue="violet"
                icon={Gauge}
              />
            </div>

            {/* Main Content */}
            <div className="stagger grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* My Issues */}
              <div className="surface-card animate-fade-up border-t-primary overflow-hidden border-t-2 shadow-none">
                <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Inbox className="text-muted-foreground h-4 w-4" />
                    <span className="text-foreground truncate text-sm font-medium">
                      {tDash('my_issues_heading')}
                    </span>
                  </div>
                  <Link
                    href="/my-issues"
                    className="text-muted-foreground hover:text-foreground ease-snap inline-flex items-center gap-1 text-xs transition-all duration-150"
                  >
                    {tActions('view_all')}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                {!myIssues || myIssues.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                    <Inbox className="text-muted-foreground mb-3 h-8 w-8" />
                    <p className="text-muted-foreground mb-4 text-sm">{tDash('all_caught_up')}</p>
                    {firstProjectId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCreateIssueOpen(true)}
                      >
                        {tActions('create_issue')}
                      </Button>
                    ) : (
                      <Link href="/projects">
                        <Button variant="outline" size="sm">
                          {tActions('create_project')}
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="divide-border divide-y px-2 py-2">
                    {myIssues.slice(0, 7).map((issue) => (
                      <IssueRow
                        key={issue.id}
                        issue={issue}
                        onClick={() => setSelectedIssueId(issue.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <StandupWidget />
                {currentOrganizationId ? (
                  <ActivityFeed organizationId={currentOrganizationId} limit={6} />
                ) : null}
              </div>
            </div>

            {/* Workspace widgets */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <YourWorkWidget />
              <UpcomingDeadlinesWidget />
              <PinnedItemsWidget />
            </div>

            <AnalyticsBento organizationId={currentOrganizationId} projectId={firstProjectId} />
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

function StatTile({
  label,
  value,
  hue,
  icon: Icon,
}: {
  label: string;
  value: number;
  hue: AccentHue;
  icon: LucideIcon;
}) {
  return (
    <div className="surface-card ease-snap border-l-primary hover:border-border-strong hover:bg-surface/50 flex min-h-[112px] flex-col justify-between border-l-2 p-4 shadow-none transition-colors duration-150">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-[11px] uppercase tracking-normal">{label}</p>
        <span className={cn('icon-tile h-8 w-8', `icon-tile-accent-${hue}`)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-foreground text-[34px] font-[400] tabular-nums leading-none tracking-normal">
        {value}
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
      className="row-interactive ease-snap hover:border-border-strong flex min-h-[42px] w-full min-w-0 cursor-pointer items-center gap-2 rounded-none border border-transparent py-2.5 pl-2 pr-3 text-left transition-all duration-150 sm:gap-3"
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
