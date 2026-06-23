'use client';

import { use } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowLeft, Calendar, Target, PlayCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSprint, useSprintIssues, useUpdateSprint } from '@/lib/hooks/use-sprints';
import { useBurndown } from '@/lib/hooks/use-analytics';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { SprintStats } from '@/components/sprints/sprint-stats';
import { BurndownChart } from '@/components/analytics/burndown-chart';
import { differenceInDays } from 'date-fns';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function SprintDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sprintId: string }>;
}) {
  const { projectId, sprintId } = use(params);
  const t = useTranslations('pagesProjects');
  const formatter = useFormatter();
  const { data: sprint, isLoading: sprintLoading } = useSprint(sprintId);
  const { data: issues, isLoading: issuesLoading } = useSprintIssues(sprintId);
  const { data: burndownData } = useBurndown(sprintId);
  const updateSprint = useUpdateSprint();
  const { permissions, isLoading: permissionsLoading } = useProjectPermissions(projectId);

  const handleStartSprint = async () => {
    if (!sprint) return;

    // Check if sprint has issues
    const issueCount = issues?.length || 0;
    if (issueCount === 0) {
      if (!confirm(t('confirmStartNoIssues'))) return;
    }

    try {
      await updateSprint.mutateAsync({
        sprintId: sprint.id,
        data: { status: 'active' },
      });
    } catch (error: unknown) {
      console.error('Error starting sprint:', error);
      alert(t('startSprintFailed'));
    }
  };

  const handleCompleteSprint = async () => {
    if (!sprint || !issues) return;

    // Check for incomplete issues
    const incompleteIssues = issues.filter((issue) => issue.statusName !== 'Done');
    const incompleteCount = incompleteIssues.length;
    const completedCount = issues.length - incompleteCount;

    let confirmMessage: string;
    if (incompleteCount > 0) {
      confirmMessage = t('confirmCompleteWithIncomplete', {
        completed: completedCount,
        incomplete: incompleteCount,
      });
    } else {
      confirmMessage = t('confirmCompleteAllDone', { completed: completedCount });
    }

    if (!confirm(confirmMessage)) return;

    try {
      await updateSprint.mutateAsync({
        sprintId: sprint.id,
        data: { status: 'completed' },
      });

      if (incompleteCount > 0) {
        alert(t('sprintCompletedMoved', { count: incompleteCount }));
      }
    } catch (error) {
      console.error('Error completing sprint:', error);
      alert(t('completeSprintFailed'));
    }
  };

  if (sprintLoading || issuesLoading || permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('loadingSprint')}</div>
      </div>
    );
  }

  // Check if user has access to view this project
  if (
    !permissions.canBrowseProject &&
    !permissions.isSuperAdmin &&
    !permissions.isOrgOwner &&
    !permissions.isOrgAdmin
  ) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Lock className="text-muted-foreground h-12 w-12" />
        <div className="text-lg font-medium">{t('accessDenied')}</div>
        <div className="text-muted-foreground">{t('noSprintPermission')}</div>
        <Link href="/projects">
          <Button variant="outline">{t('backToProjects')}</Button>
        </Link>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('sprintNotFound')}</div>
      </div>
    );
  }

  const daysRemaining = differenceInDays(new Date(sprint.endDate), new Date());
  const completedIssues = issues?.filter((issue) => issue.statusName === 'Done').length || 0;
  const totalIssues = issues?.length || 0;

  return (
    <div className="animate-fade-in flex h-full flex-col overflow-hidden">
      {/* Sprint Header */}
      <div className="animate-blur-in border-border bg-background shrink-0 border-b px-6 py-4">
        <div className="space-y-3">
          {/* Back Button */}
          <Link href={`/projects/${projectId}/sprints`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToSprints')}
            </Button>
          </Link>

          {/* Sprint Info */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">{sprint.name}</h1>
                {sprint.status === 'active' && (
                  <Badge className="bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20">
                    <span className="status-dot status-live mr-1.5" />
                    {t('statusActive')}
                  </Badge>
                )}
                {sprint.status === 'completed' && (
                  <Badge className="bg-accent-blue/10 text-accent-blue border-accent-blue/20">
                    {t('statusCompleted')}
                  </Badge>
                )}
                {sprint.status === 'planned' && (
                  <Badge variant="outline">{t('statusPlanned')}</Badge>
                )}
              </div>

              {sprint.goal && (
                <div className="text-muted-foreground flex items-start gap-2">
                  <Target className="mt-0.5 h-4 w-4" />
                  <span>{sprint.goal}</span>
                </div>
              )}

              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatter.dateTime(new Date(sprint.startDate), {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    -{' '}
                    {formatter.dateTime(new Date(sprint.endDate), {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {sprint.status === 'active' && (
                  <div>
                    {daysRemaining > 0
                      ? t('daysRemaining', { count: daysRemaining })
                      : t('sprintEnded')}
                  </div>
                )}
                <div>
                  {t('issuesCompleted', { completed: completedIssues, total: totalIssues })}
                </div>
              </div>
            </div>

            {/* Actions - Show based on granular permissions */}
            <div className="flex gap-2">
              {sprint.status === 'planned' && permissions.canStartSprint && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleStartSprint} disabled={updateSprint.isPending}>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        {t('startSprint')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('startSprintTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {sprint.status === 'active' && permissions.canCompleteSprint && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={handleCompleteSprint} disabled={updateSprint.isPending}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {t('completeSprint')}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('completeSprintTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          {/* Sprint Stats */}
          {issues && issues.length > 0 && <SprintStats sprint={sprint} issues={issues} />}

          {/* Burndown Chart */}
          {burndownData && sprint.status === 'active' && (
            <div className="surface-card rounded-lg p-5">
              <h2 className="mb-4 text-sm font-semibold">{t('sprintBurndown')}</h2>
              <BurndownChart data={burndownData} />
            </div>
          )}

          {/* Sprint Board */}
          <KanbanBoard projectId={projectId} sprintId={sprintId} />
        </div>
      </div>
    </div>
  );
}
