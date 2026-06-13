'use client';

/**
 * CycleTimeHistogram — distribution of cycle times (days from start → done).
 *
 * Accepts a pre-bucketed array or a raw list of cycle-time values which it
 * will bucket using one-day bins up to 30 days, then a 30+ overflow bin.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface CycleTimeHistogramProps {
  /** Raw cycle times in days. The component buckets them. */
  values?: number[];
  /** Pre-bucketed data. If provided, takes precedence over `values`. */
  buckets?: { bucket: string; count: number }[];
  height?: number;
}

const DEFAULT_MAX_DAYS = 30;

function bucketize(values: number[], maxDays = DEFAULT_MAX_DAYS) {
  const out: { bucket: string; count: number }[] = [];
  for (let d = 0; d <= maxDays; d++) {
    out.push({ bucket: `${d}d`, count: 0 });
  }
  out.push({ bucket: `${maxDays}+`, count: 0 });
  for (const raw of values) {
    if (raw === null || raw === undefined || Number.isNaN(raw)) continue;
    const day = Math.max(0, Math.floor(raw));
    const bucket = day > maxDays ? out[out.length - 1] : out[day];
    if (bucket) bucket.count += 1;
  }
  return out;
}

export function CycleTimeHistogram({ values, buckets, height = 240 }: CycleTimeHistogramProps) {
  const t = useTranslations('charts');
  const data = useMemo(() => {
    if (buckets && buckets.length > 0) return buckets;
    return bucketize(values ?? []);
  }, [buckets, values]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.length / 12))}
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
          formatter={(v: number) => [t('issuesCount', { count: v }), t('count')]}
          labelFormatter={(l) => t('cycleLabel', { bucket: String(l) })}
        />
        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
