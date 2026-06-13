'use client';

import { use } from 'react';
import { Download, TrendingUp, AlertCircle, Users, Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('pagesProjectTabs');
  const { data: healthData, isLoading: healthLoading } = useProjectHealth(projectId);
  const { data: velocityData, isLoading: velocityLoading } = useVelocity(projectId);

  const handleExport = (format: 'csv' | 'json') => {
    exportIssues(projectId, format);
  };

  if (healthLoading || velocityLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t('analytics.loading')}</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in h-full overflow-y-auto">
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <span className="kicker">{t('analytics.kicker')}</span>
            <h1 className="text-2xl font-semibold tracking-tight">{t('analytics.title')}</h1>
            <p className="text-muted-foreground text-sm">{t('analytics.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleExport('csv')}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => handleExport('json')}
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {healthData && (
          <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="surface-card surface-card-hover ease-snap rounded-lg p-4 transition-all duration-150">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{t('analytics.totalIssues')}</span>
                <TrendingUp className="text-muted-foreground/50 h-4 w-4" />
              </div>
              <div className="text-2xl font-semibold">{healthData.overview.totalIssues}</div>
            </div>

            <div className="surface-card surface-card-hover ease-snap rounded-lg p-4 transition-all duration-150">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{t('analytics.overdue')}</span>
                <AlertCircle className="text-destructive/50 h-4 w-4" />
              </div>
              <div className="text-destructive text-2xl font-semibold">
                {healthData.overview.overdueIssues}
              </div>
            </div>

            <div className="surface-card surface-card-hover ease-snap rounded-lg p-4 transition-all duration-150">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{t('analytics.unassigned')}</span>
                <Users className="text-muted-foreground/50 h-4 w-4" />
              </div>
              <div className="text-2xl font-semibold">{healthData.overview.unassignedIssues}</div>
            </div>

            <div className="surface-card surface-card-hover ease-snap rounded-lg p-4 transition-all duration-150">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{t('analytics.sprints')}</span>
                <Calendar className="text-muted-foreground/50 h-4 w-4" />
              </div>
              <div className="text-2xl font-semibold">{healthData.sprints.total}</div>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                {t('analytics.sprintBreakdown', {
                  active: healthData.sprints.active,
                  completed: healthData.sprints.completed,
                })}
              </p>
            </div>
          </div>
        )}

        {/* Velocity Chart */}
        {velocityData && velocityData.sprints.length > 0 && (
          <div className="surface-card rounded-lg p-5">
            <div className="mb-4">
              <p className="text-sm font-semibold">{t('analytics.sprintVelocity')}</p>
              <p className="text-muted-foreground text-xs">
                {t('analytics.velocityAverage', {
                  issues: velocityData.averageVelocity.issues.toFixed(1),
                  points: velocityData.averageVelocity.points.toFixed(1),
                })}
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
