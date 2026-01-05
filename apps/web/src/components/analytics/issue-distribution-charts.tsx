'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface IssueDistributionChartsProps {
  issuesByStatus: { status: string; count: number }[];
  issuesByPriority: { priority: string; count: number }[];
  issuesByType: { type: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  'in-progress': '#3b82f6',
  done: '#22c55e',
  backlog: '#64748b',
};

const PRIORITY_COLORS: Record<string, string> = {
  lowest: '#94a3b8',
  low: '#60a5fa',
  medium: '#fbbf24',
  high: '#fb923c',
  highest: '#ef4444',
};

const TYPE_COLORS: Record<string, string> = {
  bug: '#ef4444',
  feature: '#3b82f6',
  task: '#8b5cf6',
  story: '#10b981',
};

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
      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>By Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.name] || '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Priority Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>By Priority</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={priorityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {priorityData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PRIORITY_COLORS[entry.name] || '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>By Type</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) =>
                  `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {typeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.name] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

