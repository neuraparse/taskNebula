'use client';

import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Clock, TrendingUp } from 'lucide-react';
import { Sprint, SprintIssue } from '@/lib/hooks/use-sprints';
import { differenceInDays } from 'date-fns';

interface SprintStatsProps {
  sprint: Sprint;
  issues: SprintIssue[];
}

export function SprintStats({ sprint, issues }: SprintStatsProps) {
  // Calculate stats
  const totalIssues = issues.length;
  const completedIssues = issues.filter((issue) => issue.status === 'done' || issue.statusName === 'Done').length;
  const inProgressIssues = issues.filter((issue) => issue.status === 'in_progress' || issue.statusName === 'In Progress').length;
  const todoIssues = totalIssues - completedIssues - inProgressIssues;

  const completionPercentage = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

  // Calculate time stats
  const totalDays = differenceInDays(new Date(sprint.endDate), new Date(sprint.startDate));
  const daysElapsed = Math.max(
    0,
    Math.min(
      totalDays,
      differenceInDays(new Date(), new Date(sprint.startDate))
    )
  );
  const daysRemaining = Math.max(0, differenceInDays(new Date(sprint.endDate), new Date()));
  const timePercentage = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

  // Calculate story points (if available)
  const totalPoints = issues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
  const completedPoints = issues
    .filter((issue) => issue.status === 'done' || issue.statusName === 'Done')
    .reduce((sum, issue) => sum + (issue.estimate || 0), 0);
  const pointsPercentage = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Completion Progress */}
      <div className="surface-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Completion</span>
          <CheckCircle2 className="h-4 w-4 text-accent-emerald" />
        </div>
        <div className="text-3xl font-semibold tabular-nums text-foreground">
          {Math.round(completionPercentage)}%
        </div>
        <Progress value={completionPercentage} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {completedIssues} of {totalIssues} issues
        </p>
      </div>

      {/* Time Progress */}
      <div className="surface-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Progress</span>
          <Clock className="h-4 w-4 text-accent-amber" />
        </div>
        <div className="text-3xl font-semibold tabular-nums text-foreground">
          {Math.round(timePercentage)}%
        </div>
        <Progress value={timePercentage} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {daysRemaining} days remaining
        </p>
      </div>

      {/* Story Points */}
      <div className="surface-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Story Points</span>
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="text-3xl font-semibold tabular-nums text-foreground">
          {completedPoints}
          <span className="text-lg font-normal text-muted-foreground"> / {totalPoints}</span>
        </div>
        <Progress value={pointsPercentage} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {Math.round(pointsPercentage)}% completed
        </p>
      </div>

      {/* Issue Breakdown */}
      <div className="surface-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Issue Status</span>
          <Circle className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald inline-block" />
              Done
            </span>
            <span className="font-semibold tabular-nums">{completedIssues}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-blue inline-block" />
              In Progress
            </span>
            <span className="font-semibold tabular-nums">{inProgressIssues}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 inline-block" />
              To Do
            </span>
            <span className="font-semibold tabular-nums">{todoIssues}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
