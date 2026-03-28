'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Clock, TrendingUp } from 'lucide-react';
import { Sprint, SprintIssue } from '@/lib/hooks/use-sprints';
import { differenceInDays, format } from 'date-fns';

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(completionPercentage)}%</div>
          <Progress value={completionPercentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {completedIssues} of {totalIssues} issues
          </p>
        </CardContent>
      </Card>

      {/* Time Progress */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Time Progress</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{Math.round(timePercentage)}%</div>
          <Progress value={timePercentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {daysRemaining} days remaining
          </p>
        </CardContent>
      </Card>

      {/* Story Points */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Story Points</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {completedPoints} / {totalPoints}
          </div>
          <Progress value={pointsPercentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {Math.round(pointsPercentage)}% completed
          </p>
        </CardContent>
      </Card>

      {/* Issue Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Issue Status</CardTitle>
          <Circle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Done</span>
              <span className="font-medium">{completedIssues}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">In Progress</span>
              <span className="font-medium">{inProgressIssues}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">To Do</span>
              <span className="font-medium">{todoIssues}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

