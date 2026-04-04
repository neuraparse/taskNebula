export type ProjectIssueRow = {
  id: string;
  key: string;
  title: string;
  type: 'story' | 'task' | 'bug' | 'epic' | 'subtask';
  priority: 'critical' | 'high' | 'medium' | 'low' | 'none';
  labels: unknown;
  dueDate: Date | null;
  sprintId: string | null;
  statusCategory: string | null;
  statusName: string | null;
  assigneeId: string | null;
};

export type ProjectSprintRow = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'planned' | 'active' | 'completed';
};

export type ProjectContext = {
  project: {
    id: string;
    organizationId: string;
    name: string;
    key: string;
  };
  issues: ProjectIssueRow[];
  sprints: ProjectSprintRow[];
};
