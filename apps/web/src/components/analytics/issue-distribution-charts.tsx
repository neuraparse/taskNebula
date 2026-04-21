'use client';

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
    <div className="surface-card shadow-md rounded-md px-3 py-2 text-xs space-y-0.5">
      <p className="font-medium text-foreground capitalize">{item.name}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{item.value}</span> issues
      </p>
    </div>
  );
}

interface PieCardProps {
  kicker: string;
  title: string;
  data: { name: string; value: number }[];
  colorMap: Record<string, string>;
  fallbackColor: string;
}

function PieCard({ kicker, title, data, colorMap, fallbackColor }: PieCardProps) {
  return (
    <div className="surface-card p-6 space-y-4">
      <div className="space-y-0.5">
        <span className="kicker">{kicker}</span>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
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
    <div className="grid gap-4 md:grid-cols-3">
      <PieCard
        kicker="Distribution"
        title="By Status"
        data={statusData}
        colorMap={STATUS_COLORS}
        fallbackColor="hsl(var(--muted-foreground))"
      />
      <PieCard
        kicker="Distribution"
        title="By Priority"
        data={priorityData}
        colorMap={PRIORITY_COLORS}
        fallbackColor="hsl(var(--muted-foreground))"
      />
      <PieCard
        kicker="Distribution"
        title="By Type"
        data={typeData}
        colorMap={TYPE_COLORS}
        fallbackColor="hsl(var(--muted-foreground))"
      />
    </div>
  );
}
