'use client';

import { BurndownData } from '@/lib/hooks/use-analytics';
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
    <div className="surface-card shadow-md rounded-md px-3 py-2 text-xs space-y-1">
      <p className="text-muted-foreground font-medium">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="h-1.5 w-3 rounded-full inline-block"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function BurndownChart({ data }: BurndownChartProps) {
  return (
    <div className="surface-card p-6 space-y-5">
      {/* Header */}
      <div className="space-y-0.5">
        <span className="kicker">Sprint Progress</span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Burndown</h3>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Total Points</div>
          <div className="text-2xl font-semibold tabular-nums">{data.totalPoints}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Completed</div>
          <div className="text-2xl font-semibold tabular-nums text-accent-emerald">{data.completedPoints}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Remaining</div>
          <div className="text-2xl font-semibold tabular-nums text-accent-amber">{data.remainingPoints}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Total Issues</div>
          <div className="text-2xl font-semibold tabular-nums">{data.totalIssues}</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.burndown}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            label={{ value: 'Story Points', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<BurndownTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
          />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="hsl(var(--muted-foreground))"
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
