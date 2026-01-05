'use client';

import { use } from 'react';
import { ArrowLeft, Calendar, Target, PlayCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSprint, useSprintIssues, useUpdateSprint } from '@/lib/hooks/use-sprints';
import { useBurndown } from '@/lib/hooks/use-analytics';
import { useProjectPermissions } from '@/lib/hooks/use-project-permissions';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { SprintStats } from '@/components/sprints/sprint-stats';
import { BurndownChart } from '@/components/analytics/burndown-chart';
import { format, differenceInDays } from 'date-fns';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function SprintDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sprintId: string }>;
}) {
  const { projectId, sprintId } = use(params);
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
      if (!confirm('This sprint has no issues assigned. Start anyway?')) return;
    }

    try {
      await updateSprint.mutateAsync({
        sprintId: sprint.id,
        data: { status: 'active' },
      });
    } catch (error: unknown) {
      console.error('Error starting sprint:', error);
      // Show error message from API
      const message = error instanceof Error ? error.message : 'Failed to start sprint';
      alert(message);
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
      confirmMessage = `Sprint Summary:\n` +
        `✅ Completed: ${completedCount} issue(s)\n` +
        `⏳ Incomplete: ${incompleteCount} issue(s)\n\n` +
        `Incomplete issues will be moved to the Backlog.\n\n` +
        `Do you want to complete the sprint?`;
    } else {
      confirmMessage = `🎉 All ${completedCount} issues are completed!\n\n` +
        `Complete this sprint?`;
    }

    if (!confirm(confirmMessage)) return;

    try {
      await updateSprint.mutateAsync({
        sprintId: sprint.id,
        data: { status: 'completed' },
      });

      if (incompleteCount > 0) {
        alert(`Sprint completed! ${incompleteCount} incomplete issue(s) moved to Backlog.`);
      }
    } catch (error) {
      console.error('Error completing sprint:', error);
      alert('Failed to complete sprint. Please try again.');
    }
  };

  if (sprintLoading || issuesLoading || permissionsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading sprint...</div>
      </div>
    );
  }

  // Check if user has access to view this project
  if (!permissions.canBrowseProject && !permissions.isSuperAdmin && !permissions.isOrgOwner) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Lock className="h-12 w-12 text-muted-foreground" />
        <div className="text-lg font-medium">Access Denied</div>
        <div className="text-muted-foreground">You don't have permission to view this sprint.</div>
        <Link href="/projects">
          <Button variant="outline">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Sprint not found</div>
      </div>
    );
  }

  const daysRemaining = differenceInDays(new Date(sprint.endDate), new Date());
  const completedIssues = issues?.filter((issue) => issue.statusName === 'Done').length || 0;
  const totalIssues = issues?.length || 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sprint Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Back Button */}
          <Link href={`/projects/${projectId}/sprints`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sprints
            </Button>
          </Link>

          {/* Sprint Info */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{sprint.name}</h1>
                {sprint.status === 'active' && <Badge className="bg-green-500">Active</Badge>}
                {sprint.status === 'completed' && <Badge className="bg-blue-500">Completed</Badge>}
                {sprint.status === 'planned' && <Badge variant="outline">Planned</Badge>}
              </div>

              {sprint.goal && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Target className="h-4 w-4 mt-0.5" />
                  <span>{sprint.goal}</span>
                </div>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {format(new Date(sprint.startDate), 'MMM d')} -{' '}
                    {format(new Date(sprint.endDate), 'MMM d, yyyy')}
                  </span>
                </div>
                {sprint.status === 'active' && (
                  <div>
                    {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Sprint ended'}
                  </div>
                )}
                <div>
                  {completedIssues} / {totalIssues} issues completed
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
                        Start Sprint
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Start this sprint and make it active</p>
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
                        Complete Sprint
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Complete this sprint. Incomplete issues will move to backlog.</p>
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
        <div className="space-y-6">
          {/* Sprint Stats */}
          {issues && issues.length > 0 && (
            <div className="bg-background px-6 py-4">
              <div className="mx-auto max-w-7xl">
                <SprintStats sprint={sprint} issues={issues} />
              </div>
            </div>
          )}

          {/* Burndown Chart */}
          {burndownData && sprint.status === 'active' && (
            <div className="bg-background px-6 py-4">
              <div className="mx-auto max-w-7xl">
                <div className="rounded-lg border bg-card p-6">
                  <h2 className="mb-4 text-lg font-semibold">Sprint Burndown</h2>
                  <BurndownChart data={burndownData} />
                </div>
              </div>
            </div>
          )}

          {/* Sprint Board */}
          <div className="px-6 pb-6">
            <div className="mx-auto max-w-7xl">
              <KanbanBoard projectId={projectId} sprintId={sprintId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

