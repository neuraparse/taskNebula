'use client';

import { VelocityData } from '@/lib/hooks/use-analytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';

interface VelocityChartProps {
  data: VelocityData;
}

export function VelocityChart({ data }: VelocityChartProps) {
  const chartData = data.sprints.map((sprint) => ({
    name: sprint.sprintName,
    issues: sprint.completedIssues,
    points: sprint.completedPoints,
  }));

  // Add average lines
  const avgIssues = data.averageVelocity.issues;
  const avgPoints = data.averageVelocity.points;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="issues" fill="#8884d8" name="Completed Issues" />
        <Bar yAxisId="right" dataKey="points" fill="#82ca9d" name="Story Points" />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey={() => avgIssues}
          stroke="#ff7300"
          strokeDasharray="5 5"
          name="Avg Issues"
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={() => avgPoints}
          stroke="#387908"
          strokeDasharray="5 5"
          name="Avg Points"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

