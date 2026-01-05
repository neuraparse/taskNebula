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
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Project Analytics</h1>
            <p className="text-muted-foreground">Insights and metrics for your project</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('json')}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        {healthData && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Issues */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.overview.totalIssues}</div>
                <p className="text-xs text-muted-foreground">Across all sprints</p>
              </CardContent>
            </Card>

            {/* Overdue Issues */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Issues</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {healthData.overview.overdueIssues}
                </div>
                <p className="text-xs text-muted-foreground">Need attention</p>
              </CardContent>
            </Card>

            {/* Unassigned Issues */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.overview.unassignedIssues}</div>
                <p className="text-xs text-muted-foreground">Awaiting assignment</p>
              </CardContent>
            </Card>

            {/* Total Sprints */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sprints</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{healthData.sprints.total}</div>
                <p className="text-xs text-muted-foreground">
                  {healthData.sprints.active} active, {healthData.sprints.completed} completed
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Velocity Chart */}
        {velocityData && velocityData.sprints.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sprint Velocity</CardTitle>
              <CardDescription>
                Average velocity: {velocityData.averageVelocity.issues.toFixed(1)} issues,{' '}
                {velocityData.averageVelocity.points.toFixed(1)} points per sprint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VelocityChart data={velocityData} />
            </CardContent>
          </Card>
        )}

        {/* Issue Distribution Charts */}
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

