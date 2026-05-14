'use client';

/**
 * Burndown — ideal vs actual remaining points over the sprint.
 *
 * Pure recharts (Tremor's <AreaChart> doesn't support a "null past today"
 * gap series neatly, and we already use recharts heavily). The component is
 * data-source-agnostic: pass any { date, ideal, actual } series.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface BurndownPoint {
  date: string;
  ideal: number;
  actual: number | null;
}

export interface BurndownChartProps {
  data: BurndownPoint[];
  height?: number;
}

export function BurndownChart({ data, height = 280 }: BurndownChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="burndown-actual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
        <Line
          type="monotone"
          dataKey="ideal"
          name="Ideal"
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="actual"
          name="Actual"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#burndown-actual)"
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
