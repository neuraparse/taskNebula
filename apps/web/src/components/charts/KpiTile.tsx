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
  const tone = dir === 'flat' ? 'muted' : (dir === 'up') !== invertDelta ? 'emerald' : 'rose';

  const toneClass: Record<string, string> = {
    emerald: 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20',
    rose: 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20',
    muted: 'bg-muted text-muted-foreground',
  };
  const sparkColor =
    tone === 'rose'
      ? 'hsl(var(--accent-rose))'
      : tone === 'emerald'
        ? 'hsl(var(--accent-emerald))'
        : 'hsl(var(--muted-foreground))';

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
        'surface-card ease-snap group relative flex h-full min-h-[128px] w-full flex-col gap-2 p-4 text-left transition-all duration-150',
        onClick &&
          'focus-visible:ring-ring hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2',
        className
      )}
      aria-label={onClick ? `${label}: ${value}` : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">{label}</p>
          <p className="text-foreground mt-1 text-[30px] font-[400] tabular-nums leading-none tracking-tight">
            {value}
          </p>
          {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
        </div>
        {icon ? <div className="text-muted-foreground shrink-0">{icon}</div> : null}
      </div>

      <div className="mt-1 flex items-end justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[11px] font-medium',
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
                  <linearGradient
                    id={`spark-${label.replace(/\s+/g, '-')}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={sparkColor} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
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
                  stroke={sparkColor}
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
