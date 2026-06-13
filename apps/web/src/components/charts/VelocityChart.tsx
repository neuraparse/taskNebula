'use client';

/**
 * VelocityChart — bars for completed work per sprint, with a running average.
 */

import { useTranslations } from 'next-intl';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface VelocityPoint {
  sprintName: string;
  completedIssues: number;
  completedPoints: number;
}

export interface VelocityChartProps {
  data: VelocityPoint[];
  averagePoints?: number;
  height?: number;
}

export function VelocityChart({ data, averagePoints, height = 260 }: VelocityChartProps) {
  const t = useTranslations('charts');
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="sprintName"
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
        <Bar
          dataKey="completedPoints"
          name={t('points')}
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="completedIssues"
          name={t('issues')}
          fill="hsl(var(--accent-cyan, 215 80% 60%))"
          radius={[4, 4, 0, 0]}
        />
        {typeof averagePoints === 'number' ? (
          <Line
            type="monotone"
            dataKey={() => averagePoints}
            stroke="hsl(var(--accent-emerald, 142 76% 45%))"
            strokeWidth={2}
            strokeDasharray="5 5"
            name={t('avgPoints')}
            dot={false}
          />
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
