'use client';

/**
 * AnalyticsBento — bento grid that composes:
 *   - 4 KPI tiles
 *   - DoraPanel (full-width)
 *   - VelocityChart + ThroughputChart (2-up) with AiInsightCard above each
 *   - Monte Carlo ship-date forecast tile
 *
 * Mounted by the main dashboard page. The first project in the workspace is
 * used as the scope for project-specific charts; the dashboard can be
 * deepened with a project selector in a follow-up.
 */

import { useQuery } from '@tanstack/react-query';
import {
  AiInsightCard,
  DoraPanel,
  ForecastChart,
  KpiTile,
  ThroughputChart,
  VelocityChart,
} from '@/components/charts';
import { Gauge, Hash, Sparkles, Target, TrendingUp } from 'lucide-react';

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

export function AnalyticsBento({
  organizationId,
  projectId,
}: {
  organizationId: string | null;
  projectId: string | null;
}) {
  const { data: velocity } = useQuery<VelocityResponse>({
    queryKey: ['analytics', 'velocity', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/velocity?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to load velocity');
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
      if (!res.ok) throw new Error('Failed to load throughput');
      return res.json();
    },
    enabled: !!projectId,
  });

  const { data: forecast } = useQuery<ForecastResponse>({
    queryKey: ['analytics', 'forecast', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/forecast?projectId=${projectId}`);
      if (!res.ok) throw new Error('Failed to load forecast');
      return res.json();
    },
    enabled: !!projectId,
  });

  const lastSprint = velocity?.sprints?.[velocity.sprints.length - 1];
  const velSpark = (velocity?.sprints ?? []).map((s) => s.completedPoints);
  const tpSpark = (throughput?.data ?? []).map((d) => d.count);

  return (
    <div className="space-y-6">
      {/* KPI strip — bento-style 4-up */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Last Sprint Points"
          value={lastSprint?.completedPoints ?? '—'}
          delta={
            velocity && lastSprint
              ? lastSprint.completedPoints - velocity.averageVelocity.points
              : null
          }
          deltaSuffix=" pts"
          sparkline={velSpark}
          hint={lastSprint ? lastSprint.sprintName : 'No completed sprints'}
          icon={<Gauge className="h-4 w-4" />}
        />
        <KpiTile
          label="Avg Velocity"
          value={velocity?.averageVelocity?.points?.toFixed(1) ?? '—'}
          deltaSuffix=" pts"
          delta={null}
          sparkline={velSpark}
          hint="points / sprint"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiTile
          label="Throughput (week)"
          value={tpSpark[tpSpark.length - 1] ?? '—'}
          delta={
            tpSpark.length >= 2
              ? (tpSpark[tpSpark.length - 1] ?? 0) - (tpSpark[tpSpark.length - 2] ?? 0)
              : null
          }
          deltaSuffix=""
          sparkline={tpSpark}
          hint="issues completed"
          icon={<Hash className="h-4 w-4" />}
        />
        <KpiTile
          label="Backlog"
          value={forecast?.backlog ?? '—'}
          delta={null}
          hint={forecast ? `p50 ships ${forecast.p50Date}` : ' '}
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      {/* DORA panel */}
      <DoraPanel organizationId={organizationId} />

      {/* Main charts — 2-up */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="surface-card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="kicker">Delivery</p>
              <h3 className="text-foreground mt-1 text-base font-semibold tracking-tight">
                Velocity
              </h3>
            </div>
            <Sparkles className="text-muted-foreground h-4 w-4" />
          </div>
          <AiInsightCard metric="velocity" period="6-sprints" scopeId={projectId} />
          {velocity && velocity.sprints.length > 0 ? (
            <VelocityChart
              data={velocity.sprints}
              averagePoints={velocity.averageVelocity.points}
            />
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No completed sprints yet.
            </p>
          )}
        </section>

        <section className="surface-card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="kicker">Flow</p>
              <h3 className="text-foreground mt-1 text-base font-semibold tracking-tight">
                Throughput
              </h3>
            </div>
            <Sparkles className="text-muted-foreground h-4 w-4" />
          </div>
          <AiInsightCard metric="throughput" period="30d" scopeId={projectId} />
          {throughput && throughput.data.length > 0 ? (
            <ThroughputChart data={throughput.data} />
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No completions in the last 60 days.
            </p>
          )}
        </section>
      </div>

      {/* Forecast */}
      {forecast && forecast.histogram.length > 0 ? (
        <section className="surface-card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="kicker">Forecast</p>
              <h3 className="text-foreground mt-1 text-base font-semibold tracking-tight">
                Ship-date Monte Carlo
              </h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                1000 trajectories sampled from the last 6 sprints&apos; throughput.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-right text-xs">
              <div>
                <p className="text-muted-foreground">p50</p>
                <p className="text-foreground font-semibold tabular-nums">{forecast.p50Date}</p>
              </div>
              <div>
                <p className="text-muted-foreground">p80</p>
                <p className="text-foreground font-semibold tabular-nums">{forecast.p80Date}</p>
              </div>
              <div>
                <p className="text-muted-foreground">p95</p>
                <p className="text-foreground font-semibold tabular-nums">{forecast.p95Date}</p>
              </div>
            </div>
          </div>
          <ForecastChart
            histogram={forecast.histogram}
            p50Sprints={forecast.p50Sprints}
            p80Sprints={forecast.p80Sprints}
            p95Sprints={forecast.p95Sprints}
          />
        </section>
      ) : null}
    </div>
  );
}
