'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { IssueDetailModal } from '@/components/issues/issue-detail-modal';
import { CreateIssueModal } from '@/components/issues/create-issue-modal';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { YourWorkWidget } from '@/components/dashboard/your-work-widget';
import { UpcomingDeadlinesWidget } from '@/components/dashboard/upcoming-deadlines-widget';
import { PinnedItemsWidget } from '@/components/dashboard/pinned-items-widget';
import { AnalyticsBento } from '@/components/dashboard/analytics-bento';
import { useOrganization } from '@/lib/hooks/use-organization';
import { useProjects } from '@/lib/hooks/use-projects';
import {
  ArrowUpRight,
  Loader2,
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
import { Sparkles } from 'lucide-react';
import { ViewTransition } from '@/components/ui/view-transition';

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

  // Surface server-side permission redirects (e.g. /settings/organization without perms)
  // and the post-verify success landing (/dashboard?verified=1).
  useEffect(() => {
    const error = searchParams.get('error');
    const verified = searchParams.get('verified');

    if (error === 'insufficient-permission') {
      toast({
        title: 'Access denied',
        description: "You don't have permission to view that page.",
        variant: 'destructive',
      });
    } else if (verified === '1') {
      toast({
        title: 'Email verified',
        description: 'Welcome aboard — your account is now active.',
      });
    } else {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete('error');
    next.delete('verified');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    router.refresh();
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
      if (!response.ok) throw new Error('Failed to fetch organizations');
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
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 space-y-8">

            {/* Greeting */}
            <div className="flex items-end justify-between gap-4 animate-fade-up">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="kicker">Dashboard</span>
                  <span className="live-pill">Live</span>
                </div>
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
              <StatTile label="Active" value={stats.active} hue="blue" icon={Activity} />
              <StatTile label="Completed" value={stats.completed} hue="emerald" icon={CheckCircle2} />
              <StatTile label="Blocked" value={stats.blocked} hue="rose" icon={AlertOctagon} />
              <StatTile label="Story Points" value={stats.points} hue="violet" icon={Gauge} />
            </div>

            {/* Main Content */}
            <div className="stagger grid gap-6 lg:grid-cols-3">
              {/* My Issues */}
              <div className="surface-card p-6 lg:col-span-2 animate-fade-up">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">My Issues</span>
                  </div>
                  <Link
                    href="/my-issues"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-150 ease-snap"
                  >
                    View all
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>

                {!myIssues || myIssues.length === 0 ? (
                  /* FEAT-31 empty state — illustration + primary CTA +
                     AI fallback. The AI CTA is intentionally a TODO that
                     should call /api/ai/issues/suggest with the user's
                     recent activity context. */
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-mesh">
                      <Inbox className="h-6 w-6 text-foreground/80" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        You&apos;re all caught up
                      </p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        No assigned issues right now. Pull in your next task or let
                        AI suggest one based on your recent work.
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:flex-row">
                      {firstProjectId ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCreateIssueOpen(true)}
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5 opacity-0" aria-hidden />
                          Create issue
                        </Button>
                      ) : (
                        <Link href="/projects">
                          <Button variant="outline" size="sm">
                            Create a project first
                          </Button>
                        </Link>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        // TODO(ai): wire to /api/ai/issues/suggest using
                        // {userId, currentOrganizationId, currentTeamId}
                        onClick={() => {
                          // eslint-disable-next-line no-console
                          console.info('[ai-generate] dashboard empty state — TODO suggest flow');
                        }}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Generate with AI
                      </Button>
                    </div>
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
                <div className="surface-card p-6 animate-fade-up">
                  <ActivityFeed organizationId={currentOrganizationId} limit={5} />
                </div>
              )}
            </div>

            {/* Analytics bento — native charts + DORA + AI insights */}
            <AnalyticsBento
              organizationId={currentOrganizationId}
              projectId={firstProjectId}
            />

            {/* Workspace widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <YourWorkWidget />
              <UpcomingDeadlinesWidget />
              <PinnedItemsWidget />
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
    /* FEAT-31 example surface: hairline border + low-key shadow replacing
       the heavier surface-card defaults on KPI tiles. Stays within the
       light/dark scope because `border-white/5` falls back gracefully on
       light backgrounds where it's effectively invisible (still beats no
       border at all). */
    <div className="relative rounded-lg bg-card p-4 max-h-[140px] border border-white/5 shadow-[0_1px_0_rgba(255,255,255,0.04)] transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:shadow-md">
      <span className={cn('icon-tile', `icon-tile-accent-${hue}`)}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
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
    // FEAT-31: dashboard row → issue detail morph (matches the kanban card
    // `issue-${id}` name so navigating from any source uses the same hint).
    <ViewTransition name={`issue-${issue.id}`}>
    <button
      type="button"
      onClick={onClick}
      className="row-interactive w-full flex items-center gap-3 rounded-md pl-2 pr-3 py-2.5 min-h-[40px] text-left transition-all duration-150 ease-snap cursor-pointer"
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
    </ViewTransition>
  );
}
