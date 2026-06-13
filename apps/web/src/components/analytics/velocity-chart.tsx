'use client';

import { VelocityData } from '@/lib/hooks/use-analytics';
import { useTranslations } from 'next-intl';
import { Hash, Sparkles, TrendingUp, Zap } from 'lucide-react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';

interface VelocityChartProps {
  data: VelocityData;
}

function VelocityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface-card space-y-1 px-3 py-2 text-xs">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="text-foreground font-semibold tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan' | 'rose';

function StatTile({
  tone,
  icon,
  label,
  value,
  trend,
}: {
  tone: Tone;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: { value: string; tone: Tone };
}) {
  return (
    <div className="animate-scale-in flex items-start gap-2.5">
      <span className={`icon-tile icon-tile-accent-${tone}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-foreground text-xl font-semibold tabular-nums">{value}</span>
          {trend ? <span className={`chip-${trend.tone} text-[10px]`}>{trend.value}</span> : null}
        </div>
      </div>
    </div>
  );
}

export function VelocityChart({ data }: VelocityChartProps) {
  const t = useTranslations('charts');
  const chartData = data.sprints.map((sprint) => ({
    name: sprint.sprintName,
    issues: sprint.completedIssues,
    points: sprint.completedPoints,
  }));

  // Add average lines
  const avgIssues = data.averageVelocity.issues;
  const avgPoints = data.averageVelocity.points;
  const latest = data.sprints[data.sprints.length - 1];
  const latestIssues = latest?.completedIssues ?? 0;
  const latestPoints = latest?.completedPoints ?? 0;
  const issuesDelta = latestIssues - avgIssues;
  const pointsDelta = latestPoints - avgPoints;
  const todayKey: string | null = latest?.sprintName ?? null;

  return (
    <div className="surface-card animate-fade-up space-y-3 p-5">
      {/* Header */}
      <div className="space-y-1">
        <span className="kicker">{t('teamPerformance')}</span>
        <h3 className="text-foreground text-base font-semibold tracking-tight">{t('velocity')}</h3>
        <p className="text-muted-foreground text-sm">{t('velocityDescription')}</p>
      </div>

      {/* Stat tiles */}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          tone="blue"
          icon={<Hash className="h-3.5 w-3.5" />}
          label={t('lastIssues')}
          value={latestIssues}
          trend={
            Number.isFinite(issuesDelta)
              ? {
                  value: t('vsAvg', {
                    delta: `${issuesDelta >= 0 ? '+' : ''}${issuesDelta.toFixed(0)}`,
                  }),
                  tone: issuesDelta >= 0 ? 'emerald' : 'rose',
                }
              : undefined
          }
        />
        <StatTile
          tone="cyan"
          icon={<Zap className="h-3.5 w-3.5" />}
          label={t('lastPoints')}
          value={latestPoints}
          trend={
            Number.isFinite(pointsDelta)
              ? {
                  value: t('vsAvg', {
                    delta: `${pointsDelta >= 0 ? '+' : ''}${pointsDelta.toFixed(0)}`,
                  }),
                  tone: pointsDelta >= 0 ? 'emerald' : 'rose',
                }
              : undefined
          }
        />
        <StatTile
          tone="emerald"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label={t('avgIssues')}
          value={avgIssues.toFixed(1)}
        />
        <StatTile
          tone="amber"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label={t('avgPoints')}
          value={avgPoints.toFixed(1)}
        />
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<VelocityTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 12, fontSize: 12 }} iconType="circle" />
          {todayKey ? (
            <ReferenceLine
              yAxisId="left"
              x={todayKey}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: t('today'),
                position: 'top',
                fontSize: 10,
                fill: 'hsl(var(--muted-foreground))',
              }}
            />
          ) : null}
          <Bar
            yAxisId="left"
            dataKey="issues"
            fill="hsl(var(--primary))"
            name={t('completedIssues')}
            radius={[3, 3, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="points"
            fill="hsl(var(--accent-cyan))"
            name={t('storyPoints')}
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey={() => avgIssues}
            stroke="hsl(var(--accent-emerald))"
            strokeDasharray="5 5"
            strokeWidth={2}
            name={t('avgIssues')}
            dot={{ r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={() => avgPoints}
            stroke="hsl(var(--accent-amber))"
            strokeDasharray="5 5"
            strokeWidth={2}
            name={t('avgPoints')}
            dot={{ r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
