'use client';

import { use } from 'react';
import { Download, TrendingUp, AlertCircle, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Analytics</h1>
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
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Issues</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.overview.totalIssues}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Overdue</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive/50" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {healthData.overview.overdueIssues}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Unassigned</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground/50" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.overview.unassignedIssues}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Sprints</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground/50" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.sprints.total}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {healthData.sprints.active} active, {healthData.sprints.completed} done
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Velocity Chart */}
        {velocityData && velocityData.sprints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sprint Velocity</CardTitle>
              <CardDescription>
                Avg: {velocityData.averageVelocity.issues.toFixed(1)} issues,{' '}
                {velocityData.averageVelocity.points.toFixed(1)} points/sprint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VelocityChart data={velocityData} />
            </CardContent>
          </Card>
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
