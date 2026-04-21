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
  const completedIssues = issues.filter(
    (issue) => issue.status === 'done' || issue.statusName === 'Done'
  ).length;
  const inProgressIssues = issues.filter(
    (issue) => issue.status === 'in_progress' || issue.statusName === 'In Progress'
  ).length;
  const todoIssues = totalIssues - completedIssues - inProgressIssues;

  const completionPercentage = totalIssues > 0 ? (completedIssues / totalIssues) * 100 : 0;

  // Calculate time stats
  const totalDays = differenceInDays(new Date(sprint.endDate), new Date(sprint.startDate));
  const daysElapsed = Math.max(
    0,
    Math.min(totalDays, differenceInDays(new Date(), new Date(sprint.startDate)))
  );
  const daysRemaining = Math.max(0, differenceInDays(new Date(sprint.endDate), new Date()));
  const timePercentage = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

  // Calculate story points (if available)
  const totalPoints = issues.reduce((sum, issue) => sum + (issue.estimate || 0), 0);
  const completedPoints = issues
    .filter((issue) => issue.status === 'done' || issue.statusName === 'Done')
    .reduce((sum, issue) => sum + (issue.estimate || 0), 0);
  const pointsPercentage = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

  const statusChipClass =
    sprint.status === 'active'
      ? 'chip-blue'
      : sprint.status === 'completed'
      ? 'chip-emerald'
      : 'chip-amber';
  const statusLabel =
    sprint.status === 'active' ? 'Active' : sprint.status === 'completed' ? 'Completed' : 'Planned';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <span className="kicker">Sprint</span>
          <h3 className="truncate text-sm font-semibold tracking-tight">{sprint.name}</h3>
        </div>
        <span className={statusChipClass}>{statusLabel}</span>
      </div>
      <div className="stagger grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {/* Completion */}
      <div className="surface-card animate-scale-in p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="kicker">Completion</span>
          <CheckCircle2 className="h-4 w-4 text-accent-emerald" />
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {Math.round(completionPercentage)}%
        </div>
        <Progress value={completionPercentage} className="h-1" />
        <p className="text-xs text-muted-foreground">
          {completedIssues} of {totalIssues} issues
        </p>
      </div>

      {/* Time Progress */}
      <div className="surface-card animate-scale-in p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="kicker">Time</span>
          <Clock className="h-4 w-4 text-accent-amber" />
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {Math.round(timePercentage)}%
        </div>
        <Progress value={timePercentage} className="h-1" />
        <p className="text-xs text-muted-foreground">{daysRemaining} days remaining</p>
      </div>

      {/* Story Points */}
      <div className="surface-card animate-scale-in p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="kicker">Story Points</span>
          <TrendingUp className="h-4 w-4 text-primary" />
        </div>
        <div className="text-2xl font-semibold tabular-nums text-foreground">
          {completedPoints}
          <span className="text-base font-normal text-muted-foreground"> / {totalPoints}</span>
        </div>
        <Progress value={pointsPercentage} className="h-1" />
        <p className="text-xs text-muted-foreground">
          {Math.round(pointsPercentage)}% completed
        </p>
      </div>

      {/* Issue Breakdown */}
      <div className="surface-card animate-scale-in p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="kicker">Issues</span>
          <Circle className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-emerald inline-block" />
              Done
            </span>
            <span className="font-semibold tabular-nums">{completedIssues}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
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
    </div>
  );
}
