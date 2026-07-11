import type { Issue, WorkflowStatus } from '@/api/types';

export interface ProjectBoardColumn {
  status: WorkflowStatus;
  issues: Issue[];
}

function workflowPosition(status: WorkflowStatus): number {
  return status.position ?? Number.MAX_SAFE_INTEGER;
}

export function sortWorkflowStatuses(statuses: WorkflowStatus[]): WorkflowStatus[] {
  return [...statuses].sort(
    (left, right) =>
      workflowPosition(left) - workflowPosition(right) || left.name.localeCompare(right.name),
  );
}

export function issueBoardStatusId(
  issue: Issue,
  statuses: WorkflowStatus[],
  knownStatusIds = new Set(statuses.map((status) => status.id)),
): string | null {
  const issueStatusId = issue.statusId ?? issue.status?.id ?? null;
  if (issueStatusId && knownStatusIds.has(issueStatusId)) return issueStatusId;

  const category = issue.status?.category;
  const matchingCategory = category
    ? statuses.find((status) => status.category === category)
    : null;
  return matchingCategory?.id ?? statuses[0]?.id ?? null;
}

export function buildProjectBoardColumns(
  issues: Issue[],
  statuses: WorkflowStatus[],
): ProjectBoardColumn[] {
  const orderedStatuses = sortWorkflowStatuses(statuses);
  const knownStatusIds = new Set(orderedStatuses.map((status) => status.id));

  return orderedStatuses.map((status) => ({
    status,
    issues: issues.filter(
      (issue) => issueBoardStatusId(issue, orderedStatuses, knownStatusIds) === status.id,
    ),
  }));
}
