'use client';

import { useTranslations } from 'next-intl';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface IssueDistributionChartsProps {
  issuesByStatus: { status: string; name: string | null; color: string | null; count: number }[];
  issuesByPriority: { priority: string; count: number }[];
  issuesByType: { type: string; count: number }[];
}

// Token-mapped colors using CSS variables
const PRIORITY_COLORS: Record<string, string> = {
  lowest: 'hsl(var(--muted-foreground))',
  low: 'hsl(var(--accent-cyan))',
  medium: 'hsl(var(--accent-amber))',
  high: 'hsl(var(--accent-rose))',
  highest: 'hsl(var(--destructive))',
};

const TYPE_COLORS: Record<string, string> = {
  bug: 'hsl(var(--accent-rose))',
  feature: 'hsl(var(--primary))',
  task: 'hsl(var(--accent-violet))',
  story: 'hsl(var(--accent-emerald))',
};

// Design-system accent palette used to color slices that have no explicit /
// token color (e.g. a workflow status with no stored color).
const ACCENT_PALETTE = [
  'hsl(var(--accent-blue))',
  'hsl(var(--accent-violet))',
  'hsl(var(--accent-emerald))',
  'hsl(var(--accent-amber))',
  'hsl(var(--accent-cyan))',
  'hsl(var(--accent-rose))',
  'hsl(var(--accent-indigo))',
];

interface ChartDatum {
  /** Human-readable label shown in legend/tooltip. */
  name: string;
  value: number;
  /** Explicit color (e.g. a workflow status hex). Takes precedence. */
  color?: string;
  /** Key for the name-keyed colorMap lookup (defaults to `name`). */
  colorKey?: string;
  // Recharts' Pie `data` prop expects an index signature.
  [key: string]: string | number | undefined;
}

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
}) {
  const t = useTranslations('charts');
  const item = payload?.[0];
  if (!active || !item) return null;
  return (
    <div className="surface-card space-y-0.5 px-3 py-2 text-xs">
      <p className="text-foreground font-medium capitalize">{item.name}</p>
      <p className="text-muted-foreground">
        <span className="text-foreground font-semibold tabular-nums">{item.value}</span>{' '}
        {t('issuesLabel')}
      </p>
    </div>
  );
}

interface PieCardProps {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  colorMap: Record<string, string>;
}

function colorForDatum(entry: ChartDatum, index: number, colorMap: Record<string, string>): string {
  if (entry.color) return entry.color;
  const mapped = colorMap[entry.colorKey ?? entry.name];
  if (mapped) return mapped;
  return ACCENT_PALETTE[index % ACCENT_PALETTE.length] ?? 'hsl(var(--muted-foreground))';
}

function PieCard({ title, subtitle, data, colorMap }: PieCardProps) {
  const t = useTranslations('charts');
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <section className="animate-fade-up space-y-3 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-foreground text-base font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
        </div>
        <div className="text-right">
          <div className="text-foreground text-xl font-semibold tabular-nums">{total}</div>
          <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
            {t('total')}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={80}
            paddingAngle={1}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colorForDatum(entry, index, colorMap)} />
            ))}
          </Pie>
          <Tooltip content={<DistributionTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend — contained within the card; names truncate instead of bleeding off. */}
      <div className="flex flex-col gap-1.5">
        {data.map((entry, index) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <div key={`${entry.name}-${index}`} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorForDatum(entry, index, colorMap) }}
              />
              <span
                className="text-muted-foreground min-w-0 flex-1 truncate capitalize"
                title={entry.name}
              >
                {entry.name}
              </span>
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {entry.value} <span className="text-muted-foreground/60">{`(${pct}%)`}</span>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function IssueDistributionCharts({
  issuesByStatus,
  issuesByPriority,
  issuesByType,
}: IssueDistributionChartsProps) {
  const t = useTranslations('charts');
  const statusData: ChartDatum[] = issuesByStatus.map((item) => ({
    // Resolve the workflow status name; fall back to the raw id only if the
    // status was deleted / not joinable.
    name: item.name ?? item.status,
    value: item.count,
    ...(item.color ? { color: item.color } : {}),
  }));

  const priorityData: ChartDatum[] = issuesByPriority.map((item) => ({
    name: item.priority,
    value: item.count,
  }));

  const typeData: ChartDatum[] = issuesByType.map((item) => ({
    name: item.type,
    value: item.count,
  }));

  return (
    <section className="surface-card overflow-hidden shadow-none">
      <div className="border-border border-b px-4 py-3 sm:px-5">
        <h2 className="text-foreground text-sm font-semibold">{t('distribution')}</h2>
      </div>
      <div className="stagger divide-border divide-y md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
        <PieCard
          title={t('byStatus')}
          subtitle={t('byStatusSubtitle')}
          data={statusData}
          colorMap={{}}
        />
        <PieCard
          title={t('byPriority')}
          subtitle={t('byPrioritySubtitle')}
          data={priorityData}
          colorMap={PRIORITY_COLORS}
        />
        <PieCard
          title={t('byType')}
          subtitle={t('byTypeSubtitle')}
          data={typeData}
          colorMap={TYPE_COLORS}
        />
      </div>
    </section>
  );
}
