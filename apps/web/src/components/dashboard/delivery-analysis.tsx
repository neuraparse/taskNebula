'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  AiInsightCard,
  DoraPanel,
  ForecastChart,
  ThroughputChart,
  VelocityChart,
} from '@/components/charts';

interface ForecastResponse {
  backlog: number;
  throughputHistory: number[];
  p50Date: string;
  p80Date: string;
  p95Date: string;
  p50Sprints: number;
  p80Sprints: number;
  p95Sprints: number;
  histogram: { sprints: number; count: number }[];
}

interface VelocityResponse {
  sprints: {
    sprintName: string;
    completedIssues: number;
    completedPoints: number;
  }[];
  averageVelocity: { issues: number; points: number };
}

interface ThroughputResponse {
  data: { period: string; count: number }[];
}

interface DeliveryAnalysisProps {
  organizationId: string | null;
  projectId: string | null;
}

export function DeliveryAnalysis({ organizationId, projectId }: DeliveryAnalysisProps) {
  const t = useTranslations('dashboardExtra');
  const errorT = useTranslations('componentErrors.analytics');

  const { data: velocity } = useQuery<VelocityResponse>({
    queryKey: ['analytics', 'velocity', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/velocity?projectId=${projectId}`);
      if (!res.ok) throw new Error(errorT('velocity'));
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: throughput } = useQuery<ThroughputResponse>({
    queryKey: ['analytics', 'throughput', projectId],
    queryFn: async () => {
      const res = await fetch(
        `/api/analytics/throughput?projectId=${projectId}&bucket=week&days=60`
      );
      if (!res.ok) throw new Error(errorT('throughput'));
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ['analytics', 'forecast', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/forecast?projectId=${projectId}`);
      if (!res.ok) throw new Error(errorT('forecast'));
      return res.json();
    },
    enabled: !!projectId,
  });

  return (
    <details className="surface-card group min-w-0 overflow-hidden shadow-none">
      <summary className="row-interactive focus-visible:ring-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <span className="kicker">{t('analytics.kicker_delivery')}</span>
          <h2 className="text-foreground mt-0.5 truncate text-sm font-semibold">
            {t('analytics.heading_velocity')}
            <span className="text-muted-foreground mx-1.5" aria-hidden="true">
              {'/'}
            </span>
            {t('analytics.heading_throughput')}
          </h2>
        </div>
        <ChevronDown
          className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="border-border space-y-0 border-t">
        {organizationId ? (
          <div className="border-border border-b p-4">
            <DoraPanel organizationId={organizationId} />
          </div>
        ) : null}

        <div className="border-border grid min-w-0 border-b lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <section className="border-border min-w-0 p-4 lg:border-r">
            <div className="mb-3">
              <span className="kicker">{t('analytics.kicker_delivery')}</span>
              <h3 className="text-foreground mt-1 text-base font-semibold">
                {t('analytics.heading_velocity')}
              </h3>
            </div>
            <AiInsightCard metric="velocity" period="6-sprints" scopeId={projectId} />
            <div className="mt-3 min-w-0">
              {velocity && velocity.sprints.length > 0 ? (
                <VelocityChart
                  data={velocity.sprints}
                  averagePoints={velocity.averageVelocity.points}
                />
              ) : (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  {t('analytics.empty_velocity')}
                </p>
              )}
            </div>
          </section>

          <section className="min-w-0 p-4">
            <div className="mb-3">
              <span className="kicker">{t('analytics.kicker_flow')}</span>
              <h3 className="text-foreground mt-1 text-base font-semibold">
                {t('analytics.heading_throughput')}
              </h3>
            </div>
            <AiInsightCard metric="throughput" period="30d" scopeId={projectId} />
            <div className="mt-3 min-w-0">
              {throughput && throughput.data.length > 0 ? (
                <ThroughputChart data={throughput.data} />
              ) : (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  {t('analytics.empty_throughput')}
                </p>
              )}
            </div>
          </section>
        </div>

        {forecast && forecast.histogram.length > 0 ? (
          <section className="min-w-0 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <span className="kicker">{t('analytics.kicker_forecast')}</span>
                <h3 className="text-foreground mt-1 text-base font-semibold">
                  {t('analytics.heading_forecast')}
                </h3>
                <p className="text-muted-foreground mt-0.5 max-w-2xl text-xs">
                  {t('analytics.forecast_description')}
                </p>
              </div>
              <dl className="grid w-full grid-cols-3 gap-3 text-left text-xs sm:w-auto sm:min-w-64 sm:text-right">
                <div>
                  <dt className="text-muted-foreground">{'p50'}</dt>
                  <dd className="text-foreground truncate font-semibold tabular-nums">
                    {forecast.p50Date}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{'p80'}</dt>
                  <dd className="text-foreground truncate font-semibold tabular-nums">
                    {forecast.p80Date}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{'p95'}</dt>
                  <dd className="text-foreground truncate font-semibold tabular-nums">
                    {forecast.p95Date}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="mt-4 min-w-0">
              <ForecastChart
                histogram={forecast.histogram}
                p50Sprints={forecast.p50Sprints}
                p80Sprints={forecast.p80Sprints}
                p95Sprints={forecast.p95Sprints}
              />
            </div>
          </section>
        ) : null}
      </div>
    </details>
  );
}
