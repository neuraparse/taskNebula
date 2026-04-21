'use client';

import { AlertTriangle, Layers, ListTodo } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface IssueDistributionChartsProps {
  issuesByStatus: { status: string; count: number }[];
  issuesByPriority: { priority: string; count: number }[];
  issuesByType: { type: string; count: number }[];
}

// Token-mapped colors using CSS variables
const STATUS_COLORS: Record<string, string> = {
  todo: 'hsl(var(--muted-foreground))',
  'in-progress': 'hsl(var(--primary))',
  done: 'hsl(var(--accent-emerald))',
  backlog: 'hsl(var(--border-strong))',
};

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

function DistributionTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="surface-card px-3 py-2 text-xs space-y-0.5">
      <p className="font-medium text-foreground capitalize">{item.name}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{item.value}</span> issues
      </p>
    </div>
  );
}

type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'cyan' | 'rose';

interface PieCardProps {
  kicker: string;
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  colorMap: Record<string, string>;
  fallbackColor: string;
  tone: Tone;
  icon: React.ReactNode;
}

function PieCard({ kicker, title, subtitle, data, colorMap, fallbackColor, tone, icon }: PieCardProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div className="surface-card animate-fade-up p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className={`icon-tile icon-tile-accent-${tone} shrink-0`}>{icon}</span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <span className="kicker">{kicker}</span>
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold tabular-nums text-foreground">{total}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
        </div>
      </div>

      {/* Legend chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {data.map((entry) => (
          <span
            key={entry.name}
            className="chip inline-flex items-center gap-1.5 capitalize"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colorMap[entry.name] || fallbackColor }}
            />
            {entry.name}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name} (${((percent || 0) * 100).toFixed(0)}%)`
            }
            outerRadius={80}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={colorMap[entry.name] || fallbackColor}
              />
            ))}
          </Pie>
          <Tooltip content={<DistributionTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IssueDistributionCharts({
  issuesByStatus,
  issuesByPriority,
  issuesByType,
}: IssueDistributionChartsProps) {
  const statusData = issuesByStatus.map((item) => ({
    name: item.status,
    value: item.count,
  }));

  const priorityData = issuesByPriority.map((item) => ({
    name: item.priority,
    value: item.count,
  }));

  const typeData = issuesByType.map((item) => ({
    name: item.type,
    value: item.count,
  }));

  return (
    <div className="stagger grid gap-4 md:grid-cols-3">
      <PieCard
        kicker="Distribution"
        title="By Status"
        subtitle="Where work currently sits."
        data={statusData}
        colorMap={STATUS_COLORS}
        fallbackColor="hsl(var(--muted-foreground))"
        tone="blue"
        icon={<ListTodo className="h-3.5 w-3.5" />}
      />
      <PieCard
        kicker="Distribution"
        title="By Priority"
        subtitle="How urgent the backlog is."
        data={priorityData}
        colorMap={PRIORITY_COLORS}
        fallbackColor="hsl(var(--muted-foreground))"
        tone="amber"
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
      />
      <PieCard
        kicker="Distribution"
        title="By Type"
        subtitle="Mix of work categories."
        data={typeData}
        colorMap={TYPE_COLORS}
        fallbackColor="hsl(var(--muted-foreground))"
        tone="violet"
        icon={<Layers className="h-3.5 w-3.5" />}
      />
    </div>
  );
}
