'use client';

import { VelocityData } from '@/lib/hooks/use-analytics';
import { Hash, Sparkles, TrendingUp, Zap } from 'lucide-react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
    <div className="surface-card px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full inline-block"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="chip inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
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
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
          {trend ? (
            <span className={`chip-${trend.tone} text-[10px]`}>{trend.value}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function VelocityChart({ data }: VelocityChartProps) {
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

  return (
    <div className="surface-card animate-fade-up p-5 space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <span className="kicker">Team Performance</span>
        <h3 className="text-base font-semibold tracking-tight text-foreground">Velocity</h3>
        <p className="text-sm text-muted-foreground">
          Completed issues and story points across recent sprints.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          tone="blue"
          icon={<Hash className="h-3.5 w-3.5" />}
          label="Last Issues"
          value={latestIssues}
          trend={
            Number.isFinite(issuesDelta)
              ? {
                  value: `${issuesDelta >= 0 ? '+' : ''}${issuesDelta.toFixed(0)} vs avg`,
                  tone: issuesDelta >= 0 ? 'emerald' : 'rose',
                }
              : undefined
          }
        />
        <StatTile
          tone="cyan"
          icon={<Zap className="h-3.5 w-3.5" />}
          label="Last Points"
          value={latestPoints}
          trend={
            Number.isFinite(pointsDelta)
              ? {
                  value: `${pointsDelta >= 0 ? '+' : ''}${pointsDelta.toFixed(0)} vs avg`,
                  tone: pointsDelta >= 0 ? 'emerald' : 'rose',
                }
              : undefined
          }
        />
        <StatTile
          tone="emerald"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Avg Issues"
          value={avgIssues.toFixed(1)}
        />
        <StatTile
          tone="amber"
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Avg Points"
          value={avgPoints.toFixed(1)}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        <LegendChip color="hsl(var(--primary))" label="Issues" />
        <LegendChip color="hsl(var(--accent-cyan))" label="Points" />
        <LegendChip color="hsl(var(--accent-emerald))" label="Avg Issues" />
        <LegendChip color="hsl(var(--accent-amber))" label="Avg Points" />
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
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
          <Legend wrapperStyle={{ display: 'none' }} />
          <Bar
            yAxisId="left"
            dataKey="issues"
            fill="hsl(var(--primary))"
            name="Completed Issues"
            radius={[3, 3, 0, 0]}
          />
          <Bar
            yAxisId="right"
            dataKey="points"
            fill="hsl(var(--accent-cyan))"
            name="Story Points"
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey={() => avgIssues}
            stroke="hsl(var(--accent-emerald))"
            strokeDasharray="5 5"
            name="Avg Issues"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={() => avgPoints}
            stroke="hsl(var(--accent-amber))"
            strokeDasharray="5 5"
            name="Avg Points"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
