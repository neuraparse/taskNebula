import type { ProjectViewScope, ProjectViewType } from '@/api/types';

type IssueStatusFilter = 'all' | 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
type IssueTypeFilter = 'all' | 'task' | 'story' | 'bug' | 'epic';

export interface IssueListViewFilters {
  query: string;
  status: IssueStatusFilter;
  sprintId: 'all' | 'none' | string;
  type: IssueTypeFilter;
}

const defaultIssueListViewFilters: IssueListViewFilters = {
  query: '',
  status: 'all',
  sprintId: 'all',
  type: 'all',
};

export type ProjectViewCriteria = Record<string, unknown> & {
  search: string;
  status: IssueListViewFilters['status'];
  sprintId: IssueListViewFilters['sprintId'];
  type: IssueListViewFilters['type'];
  scope: ProjectViewScope;
  teamspaceId: string | null;
  defaultView: boolean;
  groupBy: string | null;
  visibleColumns: string[];
  sort: {
    field: string;
    direction: 'asc' | 'desc';
  };
};

const VIEW_TYPES = ['list', 'board', 'timeline', 'calendar'] as const;
const SCOPES = ['personal', 'project', 'teamspace'] as const;
const STATUS_FILTERS = ['all', 'backlog', 'todo', 'in_progress', 'in_review', 'done'] as const;
const TYPE_FILTERS = ['all', 'task', 'story', 'bug', 'epic'] as const;

export function isProjectViewType(value: unknown): value is ProjectViewType {
  return VIEW_TYPES.includes(value as ProjectViewType);
}

export function isProjectViewScope(value: unknown): value is ProjectViewScope {
  return SCOPES.includes(value as ProjectViewScope);
}

function isStatusFilter(value: unknown): value is IssueListViewFilters['status'] {
  return STATUS_FILTERS.includes(value as IssueListViewFilters['status']);
}

function isTypeFilter(value: unknown): value is IssueListViewFilters['type'] {
  return TYPE_FILTERS.includes(value as IssueListViewFilters['type']);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function filtersFromCriteria(
  criteria: Record<string, unknown> | null | undefined,
): IssueListViewFilters {
  const query =
    typeof criteria?.search === 'string'
      ? criteria.search
      : typeof criteria?.query === 'string'
        ? criteria.query
        : defaultIssueListViewFilters.query;
  return {
    query,
    status: isStatusFilter(criteria?.status) ? criteria.status : defaultIssueListViewFilters.status,
    sprintId:
      typeof criteria?.sprintId === 'string' && criteria.sprintId.trim()
        ? criteria.sprintId
        : defaultIssueListViewFilters.sprintId,
    type: isTypeFilter(criteria?.type) ? criteria.type : defaultIssueListViewFilters.type,
  };
}

export function buildProjectViewCriteria({
  filters,
  scope,
  teamspaceId = null,
  viewType,
  isDefault = false,
}: {
  filters: IssueListViewFilters;
  scope: ProjectViewScope;
  teamspaceId?: string | null;
  viewType: ProjectViewType;
  isDefault?: boolean;
}): ProjectViewCriteria {
  return {
    search: filters.query,
    status: filters.status,
    sprintId: filters.sprintId,
    type: filters.type,
    scope,
    teamspaceId: scope === 'teamspace' ? teamspaceId : null,
    defaultView: isDefault,
    groupBy: viewType === 'board' ? 'status' : viewType === 'timeline' ? 'dueMonth' : null,
    visibleColumns: ['key', 'title', 'status', 'priority', 'assignee', 'dueDate'],
    sort: {
      field: viewType === 'calendar' || viewType === 'timeline' ? 'dueDate' : 'updatedAt',
      direction: 'desc',
    },
  };
}

export function sortByViewType<T extends { dueDate?: string | null; updatedAt?: string }>(
  items: T[],
  viewType: ProjectViewType,
): T[] {
  return [...items].sort((left, right) => {
    if (viewType === 'calendar' || viewType === 'timeline') {
      const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    }

    return new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime();
  });
}

export function criteriaSummary(criteria: Record<string, unknown> | null | undefined): string[] {
  const summary: string[] = [];
  if (typeof criteria?.search === 'string' && criteria.search.trim()) {
    summary.push(criteria.search.trim());
  }
  if (typeof criteria?.status === 'string' && criteria.status !== 'all') {
    summary.push(criteria.status);
  }
  if (typeof criteria?.type === 'string' && criteria.type !== 'all') {
    summary.push(criteria.type);
  }
  summary.push(...stringArray(criteria?.labels));
  return summary;
}
