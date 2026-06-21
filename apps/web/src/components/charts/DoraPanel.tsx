'use client';

/**
 * DoraPanel — 5 DORA-style KPI tiles (deploy frequency, lead time,
 * change failure rate, rework rate, failed-deploy recovery time).
 *
 * Pulls from /api/analytics/dora?organizationId= which aggregates from the
 * GitHub deployments stream. If the org has no GitHub integration, the
 * panel renders a friendly placeholder linking to the integration settings.
 */

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Activity, GitBranch, ShieldAlert, Repeat, Timer } from 'lucide-react';
import { KpiTile } from './KpiTile';
import { Button } from '@/components/ui/button';

export interface DoraMetrics {
  connected: boolean;
  // Deploy frequency: deploys per day, last 30d.
  deployFrequencyPerDay: number;
  deployFrequencyDelta: number | null;
  deployFrequencySpark: number[];

  // Lead time: median hours from PR open → merge → deploy.
  leadTimeHours: number;
  leadTimeDelta: number | null;
  leadTimeSpark: number[];

  // Change failure rate: 0..1.
  changeFailureRate: number;
  changeFailureRateDelta: number | null;
  changeFailureRateSpark: number[];

  // Rework rate: issues reopened / closed.
  reworkRate: number;
  reworkRateDelta: number | null;
  reworkRateSpark: number[];

  // MTTR for failed deploys in hours.
  recoveryHours: number;
  recoveryHoursDelta: number | null;
  recoveryHoursSpark: number[];
}

export interface DoraPanelProps {
  organizationId: string | null;
}

export function DoraPanel({ organizationId }: DoraPanelProps) {
  const t = useTranslations('charts');
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'dora', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const res = await fetch(`/api/analytics/dora?organizationId=${organizationId}`);
      if (!res.ok) throw new Error('Failed to fetch DORA metrics');
      return (await res.json()) as DoraMetrics;
    },
    enabled: !!organizationId,
  });

  if (!organizationId) {
    return null;
  }

  if (isLoading || !data) {
    return (
      <div className="surface-card animate-pulse p-4">
        <p className="text-muted-foreground text-sm">{t('loadingDora')}</p>
      </div>
    );
  }

  if (!data.connected) {
    return (
      <div className="surface-card flex flex-col items-start gap-3 p-4">
        <div>
          <p className="kicker">{t('engineeringDora')}</p>
          <h3 className="text-foreground mt-1 text-base font-semibold tracking-tight">
            {t('connectGithubDeployments')}
          </h3>
          <p className="text-muted-foreground mt-1 text-sm">{t('doraDerivedDescription')}</p>
        </div>
        <Link href="/settings/integrations">
          <Button size="sm">{t('connectGithub')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="surface-card p-4">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="kicker">{t('engineeringDora')}</p>
          <h3 className="text-foreground mt-1 text-base font-semibold tracking-tight">
            {t('deliveryHealth')}
          </h3>
        </div>
        <p className="text-muted-foreground text-xs">{t('last30Days')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          label={t('deployFreq')}
          value={`${data.deployFrequencyPerDay.toFixed(2)}/d`}
          delta={data.deployFrequencyDelta}
          sparkline={data.deployFrequencySpark}
          hint={t('deploysPerDay')}
          icon={<GitBranch className="h-4 w-4" />}
        />
        <KpiTile
          label={t('leadTime')}
          value={`${data.leadTimeHours.toFixed(1)}h`}
          delta={data.leadTimeDelta}
          invertDelta
          sparkline={data.leadTimeSpark}
          hint={t('prToDeployMedian')}
          icon={<Timer className="h-4 w-4" />}
        />
        <KpiTile
          label={t('changeFailureRate')}
          value={`${(data.changeFailureRate * 100).toFixed(1)}%`}
          delta={data.changeFailureRateDelta}
          invertDelta
          sparkline={data.changeFailureRateSpark}
          hint={t('failedDeploysTotal')}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <KpiTile
          label={t('reworkRate')}
          value={`${(data.reworkRate * 100).toFixed(1)}%`}
          delta={data.reworkRateDelta}
          invertDelta
          sparkline={data.reworkRateSpark}
          hint={t('reopenedClosed')}
          icon={<Repeat className="h-4 w-4" />}
        />
        <KpiTile
          label={t('recoveryTime')}
          value={`${data.recoveryHours.toFixed(1)}h`}
          delta={data.recoveryHoursDelta}
          invertDelta
          sparkline={data.recoveryHoursSpark}
          hint={t('mttrFailedDeploys')}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
