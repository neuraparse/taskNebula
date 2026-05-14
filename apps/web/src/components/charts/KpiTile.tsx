'use client';

/**
 * KpiTile — reusable KPI card with value, delta and sparkline.
 *
 * Layout: large metric value on the left, trend pill underneath, sparkline
 * on the right. Built on Recharts for the spark and Tailwind for chrome.
 * Tremor is referenced only for color conventions so the rest of the
 * dashboard stays visually coherent.
 */

import { ReactNode, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

export type KpiDeltaDirection = 'up' | 'down' | 'flat';

export interface KpiTileProps {
  label: string;
  value: string | number;
  /** A signed delta (e.g. +12% or -3). Pass null/undefined to hide the badge. */
  delta?: number | null;
  /** Suffix appended to the delta (default "%"). */
  deltaSuffix?: string;
  /** If true, a positive delta is rendered as bad (e.g. defect rate). */
  invertDelta?: boolean;
  /** Series for the sparkline. */
  sparkline?: number[];
  /** Optional sparkline label (used in tooltip). */
  sparklineLabel?: string;
  /** Optional helper text below value. */
  hint?: string;
  /** Optional click handler. Makes the entire tile interactive. */
  onClick?: () => void;
  /** Right-aligned icon adornment. */
  icon?: ReactNode;
  className?: string;
}

function directionFromDelta(delta: number | null | undefined): KpiDeltaDirection {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return 'flat';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

export function KpiTile({
  label,
  value,
  delta,
  deltaSuffix = '%',
  invertDelta = false,
  sparkline,
  sparklineLabel = 'value',
  hint,
  onClick,
  icon,
  className,
}: KpiTileProps) {
  const dir = directionFromDelta(delta);

  // For "good = down" metrics, swap the visual tone.
  const tone =
    dir === 'flat'
      ? 'muted'
      : (dir === 'up') !== invertDelta
        ? 'emerald'
        : 'rose';

  const toneClass: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    muted: 'bg-muted text-muted-foreground',
  };

  const sparkData = useMemo(
    () =>
      (sparkline ?? []).map((v, i) => ({
        i,
        v: Number.isFinite(v) ? v : 0,
      })),
    [sparkline]
  );

  const Wrap = onClick ? 'button' : 'div';

  return (
    <Wrap
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'surface-card group relative flex h-full w-full flex-col gap-2 p-4 text-left transition-all duration-150 ease-snap',
        onClick && 'hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      aria-label={onClick ? `${label}: ${value}` : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        {icon ? <div className="shrink-0 text-muted-foreground">{icon}</div> : null}
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            toneClass[tone]
          )}
        >
          {dir === 'up' ? (
            <TrendingUp className="h-3 w-3" />
          ) : dir === 'down' ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {delta === null || delta === undefined || Number.isNaN(delta)
            ? '—'
            : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}${deltaSuffix}`}
        </span>

        {sparkData.length > 1 ? (
          <div className="h-10 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={tone === 'rose' ? '#f43f5e' : tone === 'emerald' ? '#10b981' : '#94a3b8'}
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="100%"
                      stopColor={tone === 'rose' ? '#f43f5e' : tone === 'emerald' ? '#10b981' : '#94a3b8'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ display: 'none' }}
                  cursor={{ stroke: 'transparent' }}
                  labelFormatter={() => sparklineLabel}
                />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={tone === 'rose' ? '#f43f5e' : tone === 'emerald' ? '#10b981' : '#94a3b8'}
                  strokeWidth={1.5}
                  fill={`url(#spark-${label.replace(/\s+/g, '-')})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </Wrap>
  );
}
