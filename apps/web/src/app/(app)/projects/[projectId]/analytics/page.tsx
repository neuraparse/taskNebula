'use client';

import { use } from 'react';
import { Download, TrendingUp, AlertCircle, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProjectHealth, useVelocity, exportIssues } from '@/lib/hooks/use-analytics';
import { VelocityChart } from '@/components/analytics/velocity-chart';
import { IssueDistributionCharts } from '@/components/analytics/issue-distribution-charts';

export default function ProjectAnalyticsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { data: healthData, isLoading: healthLoading } = useProjectHealth(projectId);
  const { data: velocityData, isLoading: velocityLoading } = useVelocity(projectId);

  const handleExport = (format: 'csv' | 'json') => {
    exportIssues(projectId, format);
  };

  if (healthLoading || velocityLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto animate-fade-in">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="kicker">Project</span>
            <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">Insights and metrics for your project</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExport('csv')}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleExport('json')}>
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {healthData && (
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Total Issues</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div className="text-2xl font-semibold">{healthData.overview.totalIssues}</div>
            </div>

            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Overdue</span>
                <AlertCircle className="h-4 w-4 text-destructive/50" />
              </div>
              <div className="text-2xl font-semibold text-destructive">
                {healthData.overview.overdueIssues}
              </div>
            </div>

            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Unassigned</span>
                <Users className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div className="text-2xl font-semibold">{healthData.overview.unassignedIssues}</div>
            </div>

            <div className="surface-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Sprints</span>
                <Calendar className="h-4 w-4 text-muted-foreground/50" />
              </div>
              <div className="text-2xl font-semibold">{healthData.sprints.total}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {healthData.sprints.active} active, {healthData.sprints.completed} done
              </p>
            </div>
          </div>
        )}

        {/* Velocity Chart */}
        {velocityData && velocityData.sprints.length > 0 && (
          <div className="surface-card p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold">Sprint Velocity</p>
              <p className="text-xs text-muted-foreground">
                Avg: {velocityData.averageVelocity.issues.toFixed(1)} issues,{' '}
                {velocityData.averageVelocity.points.toFixed(1)} points/sprint
              </p>
            </div>
            <VelocityChart data={velocityData} />
          </div>
        )}

        {/* Distribution Charts */}
        {healthData && (
          <IssueDistributionCharts
            issuesByStatus={healthData.issuesByStatus}
            issuesByPriority={healthData.issuesByPriority}
            issuesByType={healthData.issuesByType}
          />
        )}
      </div>
    </div>
  );
}
