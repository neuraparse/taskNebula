'use client';

import { use } from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useProjectHealth, useVelocity, exportIssues } from '@/lib/hooks/use-analytics';
import { VelocityChart } from '@/components/analytics/velocity-chart';
import { IssueDistributionCharts } from '@/components/analytics/issue-distribution-charts';
import { PageFrame } from '@/components/ui/page-frame';
import { PageHeader } from '@/components/ui/page-header';
import { MetricStrip, type MetricStripItem } from '@/components/ui/metric-strip';

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

  const metrics: MetricStripItem[] = healthData
    ? [
        {
          id: 'total',
          label: t('analytics.totalIssues'),
          value: healthData.overview.totalIssues,
        },
        {
          id: 'overdue',
          label: t('analytics.overdue'),
          value: <span className="text-destructive">{healthData.overview.overdueIssues}</span>,
        },
        {
          id: 'unassigned',
          label: t('analytics.unassigned'),
          value: healthData.overview.unassignedIssues,
        },
        {
          id: 'sprints',
          label: t('analytics.sprints'),
          value: healthData.sprints.total,
          hint: t('analytics.sprintBreakdown', {
            active: healthData.sprints.active,
            completed: healthData.sprints.completed,
          }),
        },
      ]
    : [];

  return (
    <PageFrame className="animate-fade-in" contentClassName="space-y-6">
      <PageHeader
        kicker={t('analytics.kicker')}
        title={t('analytics.title')}
        description={t('analytics.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 gap-1.5 text-xs sm:flex-none"
              onClick={() => handleExport('csv')}
            >
              <Download className="h-3.5 w-3.5" />
              {t('analytics.exportCsv')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 gap-1.5 text-xs sm:flex-none"
              onClick={() => handleExport('json')}
            >
              <Download className="h-3.5 w-3.5" />
              {t('analytics.exportJson')}
            </Button>
          </div>
        }
      />

      {metrics.length > 0 ? <MetricStrip items={metrics} /> : null}

      {velocityData && velocityData.sprints.length > 0 && <VelocityChart data={velocityData} />}

      {healthData && (
        <IssueDistributionCharts
          issuesByStatus={healthData.issuesByStatus}
          issuesByPriority={healthData.issuesByPriority}
          issuesByType={healthData.issuesByType}
        />
      )}
    </PageFrame>
  );
}
