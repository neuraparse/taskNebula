import type { AuditableEntity, ID } from './common';

// Workflow
export interface Workflow extends AuditableEntity {
  organizationId: ID;
  name: string;
  description?: string;
  isDefault: boolean;
  statuses: WorkflowStatus[];
  transitions: WorkflowTransition[];
}

// Workflow Status (column in Kanban)
export interface WorkflowStatus {
  id: ID;
  name: string;
  category: WorkflowStatusCategory;
  color: string;
  position: number;
}

export type WorkflowStatusCategory = 'backlog' | 'in_progress' | 'in_review' | 'done' | 'blocked';

// Workflow Transition (allowed status changes)
export interface WorkflowTransition {
  id: ID;
  name: string;
  fromStatusId: ID;
  toStatusId: ID;
  conditions?: TransitionCondition[];
  validators?: TransitionValidator[];
  postActions?: TransitionAction[];
}

export interface TransitionCondition {
  type: 'role' | 'field' | 'custom';
  config: Record<string, unknown>;
}

export interface TransitionValidator {
  type: 'required_field' | 'custom';
  config: Record<string, unknown>;
}

export interface TransitionAction {
  type: 'assign' | 'notify' | 'webhook' | 'custom';
  config: Record<string, unknown>;
}

// Automation Rule
export interface AutomationRule extends AuditableEntity {
  organizationId: ID;
  projectId?: ID; // null = org-wide
  name: string;
  description?: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
}

export interface AutomationTrigger {
  type: 'issue_created' | 'issue_updated' | 'status_changed' | 'field_changed' | 'scheduled';
  config: Record<string, unknown>;
}

export interface AutomationCondition {
  type: 'field_equals' | 'field_contains' | 'user_role' | 'custom';
  config: Record<string, unknown>;
}

export interface AutomationAction {
  type: 'update_field' | 'assign' | 'add_label' | 'send_notification' | 'webhook' | 'custom';
  config: Record<string, unknown>;
}

