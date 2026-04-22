/**
 * View state primitives for Plane-style issue views.
 *
 * Defines the shape of the filter chips rendered by `ViewFilterBar`
 * and the display option toggles rendered by `ViewDisplayOptions`,
 * plus default factories used when a parent view has no persisted state.
 */

export type FilterOperator = 'is' | 'is_not' | 'is_empty' | 'is_not_empty';

export interface ViewFilter {
  field: string;
  op: FilterOperator;
  values: string[];
}

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterField {
  /** Stable machine key, e.g. "state". Matches `ViewFilter.field`. */
  key: string;
  /** Human label used in the field picker and the chip prefix. */
  label: string;
  /** Whether the field accepts multiple values (controls operator set). */
  multi?: boolean;
  /** Static options for the value picker. Omit for free-text entry. */
  options?: FilterFieldOption[];
}

export type GroupByKey =
  | 'none'
  | 'state'
  | 'priority'
  | 'assignee'
  | 'labels'
  | 'cycle'
  | 'module';

export type SortByKey =
  | 'manual'
  | 'created'
  | 'updated'
  | 'start_date'
  | 'due_date'
  | 'priority';

export type DisplayPropertyKey =
  | 'id'
  | 'type'
  | 'priority'
  | 'state'
  | 'assignee'
  | 'labels'
  | 'due_date'
  | 'created_at'
  | 'updated_at'
  | 'estimate'
  | 'cycle'
  | 'module';

export type DisplayProperties = Record<DisplayPropertyKey, boolean>;

export interface DisplayOptions {
  properties: DisplayProperties;
  groupBy: GroupByKey;
  subGroupBy: GroupByKey;
  sortBy: SortByKey;
  showEmptyGroups: boolean;
  showSubIssues: boolean;
}

/**
 * Default field catalog mirroring Plane's standard issue facets.
 * Consumers may override via `availableFields` on `ViewFilterBar`.
 */
export const DEFAULT_FILTER_FIELDS: FilterField[] = [
  {
    key: 'state',
    label: 'State',
    multi: true,
    options: [
      { value: 'backlog', label: 'Backlog' },
      { value: 'todo', label: 'Todo' },
      { value: 'in_progress', label: 'In progress' },
      { value: 'done', label: 'Done' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
  },
  {
    key: 'priority',
    label: 'Priority',
    multi: true,
    options: [
      { value: 'urgent', label: 'Urgent' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' },
      { value: 'none', label: 'None' },
    ],
  },
  { key: 'assignee', label: 'Assignee', multi: true },
  { key: 'labels', label: 'Labels', multi: true },
  {
    key: 'type',
    label: 'Type',
    multi: true,
    options: [
      { value: 'task', label: 'Task' },
      { value: 'bug', label: 'Bug' },
      { value: 'feature', label: 'Feature' },
      { value: 'epic', label: 'Epic' },
    ],
  },
  { key: 'cycle', label: 'Cycle', multi: true },
  { key: 'module', label: 'Module', multi: true },
  { key: 'created_by', label: 'Created by', multi: true },
  { key: 'due_date', label: 'Due date', multi: false },
];

export const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  properties: {
    id: true,
    type: false,
    priority: true,
    state: true,
    assignee: true,
    labels: true,
    due_date: true,
    created_at: false,
    updated_at: false,
    estimate: false,
    cycle: false,
    module: false,
  },
  groupBy: 'state',
  subGroupBy: 'none',
  sortBy: 'manual',
  showEmptyGroups: false,
  showSubIssues: true,
};

export function defaultFilters(): ViewFilter[] {
  return [];
}

/**
 * Returns the operator set valid for a given field. Empty/non-empty operators
 * only make sense on multi-value fields (Plane behaviour).
 */
export function operatorsForField(field: FilterField | undefined): FilterOperator[] {
  if (field?.multi) {
    return ['is', 'is_not', 'is_empty', 'is_not_empty'];
  }
  return ['is', 'is_not'];
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: 'is',
  is_not: 'is not',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

export const GROUP_BY_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'state', label: 'State' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'labels', label: 'Labels' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'module', label: 'Module' },
];

export const SORT_BY_OPTIONS: { value: SortByKey; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'start_date', label: 'Start date' },
  { value: 'due_date', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
];

export const DISPLAY_PROPERTY_LABELS: Record<DisplayPropertyKey, string> = {
  id: 'ID',
  type: 'Type',
  priority: 'Priority',
  state: 'State',
  assignee: 'Assignee',
  labels: 'Labels',
  due_date: 'Due date',
  created_at: 'Created at',
  updated_at: 'Updated at',
  estimate: 'Estimate',
  cycle: 'Cycle',
  module: 'Module',
};
