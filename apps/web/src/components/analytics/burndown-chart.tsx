'use client';

import { BurndownData } from '@/lib/hooks/use-analytics';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface BurndownChartProps {
  data: BurndownData;
}

export function BurndownChart({ data }: BurndownChartProps) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground">Total Points</div>
          <div className="text-2xl font-bold">{data.totalPoints}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold text-green-600">{data.completedPoints}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Remaining</div>
          <div className="text-2xl font-bold text-orange-600">{data.remainingPoints}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Total Issues</div>
          <div className="text-2xl font-bold">{data.totalIssues}</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data.burndown}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis label={{ value: 'Story Points', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="ideal"
            stroke="#94a3b8"
            strokeDasharray="5 5"
            name="Ideal Burndown"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#3b82f6"
            strokeWidth={2}
            name="Actual Burndown"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

