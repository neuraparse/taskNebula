'use client';

import { VelocityData } from '@/lib/hooks/use-analytics';
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

export function VelocityChart({ data }: VelocityChartProps) {
  const chartData = data.sprints.map((sprint) => ({
    name: sprint.sprintName,
    issues: sprint.completedIssues,
    points: sprint.completedPoints,
  }));

  // Add average lines
  const avgIssues = data.averageVelocity.issues;
  const avgPoints = data.averageVelocity.points;

  return (
    <div className="surface-card p-6 space-y-4">
      {/* Header */}
      <div className="space-y-0.5">
        <span className="kicker">Team Performance</span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Velocity</h3>
      </div>

      <ResponsiveContainer width="100%" height={300}>
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
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
          />
          <Bar yAxisId="left" dataKey="issues" fill="hsl(var(--primary))" name="Completed Issues" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="right" dataKey="points" fill="hsl(var(--accent-cyan))" name="Story Points" radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey={() => avgIssues}
            stroke="hsl(var(--accent-amber))"
            strokeDasharray="5 5"
            name="Avg Issues"
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={() => avgPoints}
            stroke="hsl(var(--accent-rose))"
            strokeDasharray="5 5"
            name="Avg Points"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
