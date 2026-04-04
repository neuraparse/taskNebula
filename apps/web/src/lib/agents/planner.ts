import type { AgentRunKind } from './config';

type PlanningIssue = {
  id: string;
  key: string;
  title: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low' | 'none';
  labels: string[];
  dueDate: string | Date | null;
};

type PlannedSprint = {
  name: string;
  goal: string;
  startDate: Date;
  endDate: Date;
  issues: PlanningIssue[];
};

const PRIORITY_SCORE: Record<PlanningIssue['priority'], number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
};

export function deriveTriagePriority(issue: PlanningIssue): PlanningIssue['priority'] {
  const labels = issue.labels.map((label) => label.toLowerCase());
  const dueDate = issue.dueDate ? new Date(issue.dueDate) : null;
  const now = new Date();
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  let score = PRIORITY_SCORE[issue.priority];

  if (issue.type === 'bug') {
    score += 2;
  }

  if (labels.some((label) => ['blocker', 'incident', 'outage', 'security', 'urgent'].includes(label))) {
    score += 3;
  }

  if (daysUntilDue !== null && daysUntilDue <= 2) {
    score += 3;
  } else if (daysUntilDue !== null && daysUntilDue <= 5) {
    score += 2;
  } else if (daysUntilDue !== null && daysUntilDue <= 10) {
    score += 1;
  }

  if (score >= 8) {
    return 'critical';
  }

  if (score >= 6) {
    return 'high';
  }

  if (score >= 4) {
    return 'medium';
  }

  return 'low';
}

export function rankIssuesForPlanning(issues: PlanningIssue[]) {
  return [...issues].sort((left, right) => {
    const priorityDelta = PRIORITY_SCORE[deriveTriagePriority(right)] - PRIORITY_SCORE[deriveTriagePriority(left)];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return left.key.localeCompare(right.key);
  });
}

export function buildSprintBatchPlan({
  issues,
  sprintBatchSize,
  sprintLengthDays,
  issueCapacityPerSprint,
  startDate,
  existingSprintCount,
}: {
  issues: PlanningIssue[];
  sprintBatchSize: number;
  sprintLengthDays: number;
  issueCapacityPerSprint: number;
  startDate: Date;
  existingSprintCount: number;
}): PlannedSprint[] {
  const rankedIssues = rankIssuesForPlanning(issues);
  const plan: PlannedSprint[] = [];

  for (let index = 0; index < sprintBatchSize; index += 1) {
    const assignedIssues = rankedIssues.splice(0, issueCapacityPerSprint);
    if (assignedIssues.length === 0) {
      break;
    }

    const sprintStart = new Date(startDate);
    sprintStart.setDate(sprintStart.getDate() + index * sprintLengthDays);

    const sprintEnd = new Date(sprintStart);
    sprintEnd.setDate(sprintEnd.getDate() + sprintLengthDays - 1);

    const sprintNumber = existingSprintCount + index + 1;
    const goalSeed = assignedIssues
      .slice(0, 3)
      .map((issue) => issue.title)
      .join(', ');

    plan.push({
      name: `Sprint ${sprintNumber}`,
      goal: `Deliver ${goalSeed}${assignedIssues.length > 3 ? ', and related follow-up work' : ''}.`,
      startDate: sprintStart,
      endDate: sprintEnd,
      issues: assignedIssues,
    });
  }

  return plan;
}

export function getRunKindSummary(kind: AgentRunKind) {
  switch (kind) {
    case 'project_tracking':
      return 'Project health scan';
    case 'backlog_triage':
      return 'Backlog triage';
    case 'sprint_planning':
      return 'Sprint planning preview';
    case 'bulk_sprint_creation':
      return 'Bulk sprint creation';
    default:
      return 'Agent run';
  }
}
