'use client';

import { BurndownData } from '@/lib/hooks/use-analytics';
import { CheckCircle2, Clock, Hash, Target } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BurndownChartProps {
  data: BurndownData;
}

function BurndownTooltip({ active, payload, label }: any) {
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

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="chip inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function BurndownChart({ data }: BurndownChartProps) {
  return (
    <div className="surface-card animate-fade-up p-5 space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <span className="kicker">Sprint Progress</span>
        <h3 className="text-base font-semibold tracking-tight text-foreground">Burndown</h3>
        <p className="text-sm text-muted-foreground">
          Actual versus ideal story-point completion.
        </p>
      </div>

      {/* Stat tiles */}
      <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          tone="blue"
          icon={<Target className="h-3.5 w-3.5" />}
          label="Total Points"
          value={data.totalPoints}
        />
        <StatTile
          tone="emerald"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Completed"
          value={data.completedPoints}
        />
        <StatTile
          tone="amber"
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Remaining"
          value={data.remainingPoints}
        />
        <StatTile
          tone="violet"
          icon={<Hash className="h-3.5 w-3.5" />}
          label="Total Issues"
          value={data.totalIssues}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        <LegendChip color="hsl(var(--primary))" label="Actual" />
        <LegendChip color="hsl(var(--accent-emerald))" label="Ideal" />
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data.burndown}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            label={{
              value: 'Story Points',
              angle: -90,
              position: 'insideLeft',
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
            }}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<BurndownTooltip />} />
          <Legend wrapperStyle={{ display: 'none' }} />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="hsl(var(--accent-emerald))"
            strokeDasharray="5 5"
            name="Ideal Burndown"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            name="Actual Burndown"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
