'use client';

import { useQuery } from '@tanstack/react-query';

export interface VelocityData {
  sprints: {
    sprintId: string;
    sprintName: string;
    startDate: Date;
    endDate: Date;
    completedIssues: number;
    completedPoints: number;
  }[];
  averageVelocity: {
    issues: number;
    points: number;
  };
}

export interface ProjectHealthData {
  overview: {
    totalIssues: number;
    overdueIssues: number;
    unassignedIssues: number;
  };
  sprints: {
    total: number;
    active: number;
    completed: number;
  };
  issuesByStatus: {
    status: string;
    count: number;
  }[];
  issuesByPriority: {
    priority: string;
    count: number;
  }[];
  issuesByType: {
    type: string;
    count: number;
  }[];
}

export interface BurndownData {
  sprintName: string;
  startDate: Date;
  endDate: Date;
  totalPoints: number;
  totalIssues: number;
  completedPoints: number;
  remainingPoints: number;
  burndown: {
    date: string;
    ideal: number;
    actual: number | null;
  }[];
}

// Fetch velocity data
export function useVelocity(projectId: string | null) {
  return useQuery({
    queryKey: ['analytics', 'velocity', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const response = await fetch(`/api/analytics/velocity?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch velocity data');
      return response.json() as Promise<VelocityData>;
    },
    enabled: !!projectId,
  });
}

// Fetch project health data
export function useProjectHealth(projectId: string | null) {
  return useQuery({
    queryKey: ['analytics', 'project-health', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const response = await fetch(`/api/analytics/project-health?projectId=${projectId}`);
      if (!response.ok) throw new Error('Failed to fetch project health data');
      return response.json() as Promise<ProjectHealthData>;
    },
    enabled: !!projectId,
  });
}

// Fetch burndown data
export function useBurndown(sprintId: string | null) {
  return useQuery({
    queryKey: ['analytics', 'burndown', sprintId],
    queryFn: async () => {
      if (!sprintId) return null;
      const response = await fetch(`/api/analytics/burndown?sprintId=${sprintId}`);
      if (!response.ok) throw new Error('Failed to fetch burndown data');
      return response.json() as Promise<BurndownData>;
    },
    enabled: !!sprintId,
  });
}

// Export issues
export function exportIssues(projectId: string, format: 'csv' | 'json' = 'csv') {
  const url = `/api/export/issues?projectId=${projectId}&format=${format}`;
  window.open(url, '_blank');
}

