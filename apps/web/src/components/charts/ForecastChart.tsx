'use client';

/**
 * ForecastChart — small bar chart of the Monte Carlo distribution over
 * sprints-to-ship. p50/p80/p95 reference lines are highlighted.
 */

import { useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface ForecastChartProps {
  histogram: { sprints: number; count: number }[];
  p50Sprints?: number;
  p80Sprints?: number;
  p95Sprints?: number;
  height?: number;
}

export function ForecastChart({
  histogram,
  p50Sprints,
  p80Sprints,
  p95Sprints,
  height = 200,
}: ForecastChartProps) {
  const t = useTranslations('charts');
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={histogram} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="sprints"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [t('trajectoriesCount', { count: v }), t('count')]}
          labelFormatter={(l) => t('sprintsLabel', { count: Number(l) })}
        />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        {typeof p50Sprints === 'number' ? (
          <ReferenceLine
            x={p50Sprints}
            stroke="hsl(var(--accent-emerald, 142 76% 45%))"
            strokeDasharray="4 4"
            label={{ value: 'p50', position: 'top', fontSize: 10 }}
          />
        ) : null}
        {typeof p80Sprints === 'number' ? (
          <ReferenceLine
            x={p80Sprints}
            stroke="hsl(var(--accent-amber, 38 92% 50%))"
            strokeDasharray="4 4"
            label={{ value: 'p80', position: 'top', fontSize: 10 }}
          />
        ) : null}
        {typeof p95Sprints === 'number' ? (
          <ReferenceLine
            x={p95Sprints}
            stroke="hsl(var(--accent-rose, 350 80% 55%))"
            strokeDasharray="4 4"
            label={{ value: 'p95', position: 'top', fontSize: 10 }}
          />
        ) : null}
      </BarChart>
    </ResponsiveContainer>
  );
}
