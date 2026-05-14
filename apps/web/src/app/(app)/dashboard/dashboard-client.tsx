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
import { StandupWidget } from '@/components/dashboard/standup-widget';
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
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Inbox className="h-8 w-8 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      You&apos;re all caught up.
                    </p>
                    {firstProjectId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCreateIssueOpen(true)}
                      >
                        Create issue
                      </Button>
                    ) : (
                      <Link href="/projects">
                        <Button variant="outline" size="sm">
                          Create a project first
                        </Button>
                      </Link>
                    )}
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

            {/* Standup digest — surfaced separately so it occupies the full
                width when present and degrades to a small CTA when empty. */}
            <div className="mt-6">
              <StandupWidget />
            </div>

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
    <div className="surface-card surface-card-hover p-4 max-h-[140px] transition-all duration-150 ease-snap hover:-translate-y-0.5 hover:shadow-md">
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
  );
}
