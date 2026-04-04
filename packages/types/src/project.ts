import type { AuditableEntity, ID } from './common';

// Project
export interface Project extends AuditableEntity {
  organizationId: ID;
  teamId?: ID;
  key: string; // e.g., "TASK", "PROJ" - used in issue keys like TASK-123
  name: string;
  description?: string;
  iconUrl?: string;
  leadId?: ID; // User ID
  defaultWorkflowId?: ID;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  settings: ProjectSettings;
  startDate?: string;
  targetDate?: string;
}

export type ProjectVisibility = 'private' | 'internal' | 'public';

export type ProjectStatus = 'active' | 'archived' | 'on_hold';

export interface ProjectSettings {
  issueTypes: IssueTypeConfig[];
  customFields: CustomFieldConfig[];
  integrations: {
    github?: {
      enabled: boolean;
      repositories: string[];
    };
    slack?: {
      enabled: boolean;
      channelId: string;
    };
  };
  communications?: {
    enabled: boolean;
    inheritWorkspaceDefaults?: boolean;
    voiceEnabled: boolean;
    issueThreadsEnabled: boolean;
    documentThreadsEnabled: boolean;
    attachmentsEnabled: boolean;
    unreadTrackingEnabled: boolean;
  };
}

// Issue Type Configuration
export interface IssueTypeConfig {
  id: ID;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
}

// Custom Field Configuration
export interface CustomFieldConfig {
  id: ID;
  name: string;
  key: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[]; // For select/multi-select
  defaultValue?: string | number | boolean;
}

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'user';

// Sprint
export interface Sprint extends AuditableEntity {
  projectId: ID;
  name: string;
  goal?: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
}

export type SprintStatus = 'planned' | 'active' | 'completed';
