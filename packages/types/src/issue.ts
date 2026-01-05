import type { AuditableEntity, ID } from './common';

// Issue (Core entity)
export interface Issue extends AuditableEntity {
  organizationId: ID;
  projectId: ID;
  key: string; // e.g., "TASK-123"
  number: number; // Sequential number within project
  type: IssueType;
  title: string;
  description?: string; // Rich text / Markdown
  status: ID; // References workflow status
  priority: IssuePriority;
  assigneeId?: ID;
  reporterId: ID;
  labels: string[];
  sprintId?: ID;
  epicId?: ID; // Parent epic
  parentId?: ID; // For subtasks
  estimate?: number; // Story points or hours
  dueDate?: string;
  customFields: Record<string, CustomFieldValue>;
  metadata: IssueMetadata;
}

export type IssueType = 'story' | 'task' | 'bug' | 'epic' | 'subtask';

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low' | 'none';

export type CustomFieldValue = string | number | boolean | string[] | null;

export interface IssueMetadata {
  viewCount: number;
  commentCount: number;
  attachmentCount: number;
  linkedIssueCount: number;
}

// Issue Comment
export interface IssueComment extends AuditableEntity {
  issueId: ID;
  parentId?: ID; // For threaded comments
  content: string; // Rich text / Markdown
  mentions: ID[]; // User IDs mentioned
  reactions: CommentReaction[];
  isInternal: boolean; // Internal notes vs public comments
}

export interface CommentReaction {
  emoji: string;
  userId: ID;
  createdAt: string;
}

// Issue Activity / History
export interface IssueActivity extends AuditableEntity {
  issueId: ID;
  userId: ID;
  type: IssueActivityType;
  field?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

export type IssueActivityType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'commented'
  | 'linked'
  | 'mentioned';

// Issue Link (relationships between issues)
export interface IssueLink extends AuditableEntity {
  sourceIssueId: ID;
  targetIssueId: ID;
  type: IssueLinkType;
}

export type IssueLinkType =
  | 'blocks'
  | 'blocked_by'
  | 'relates_to'
  | 'duplicates'
  | 'duplicated_by'
  | 'parent_of'
  | 'child_of';

// Issue Attachment
export interface IssueAttachment extends AuditableEntity {
  issueId: ID;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
}

