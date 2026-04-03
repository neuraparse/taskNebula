import type { AuditableEntity, ID } from './common';

export type DocumentSpaceScope = 'organization' | 'project';

export interface DocumentSpace extends AuditableEntity {
  organizationId: ID;
  projectId?: ID | null;
  scope: DocumentSpaceScope;
  name: string;
  slug: string;
  description?: string | null;
  isDefault: boolean;
}

export interface DocumentPage extends AuditableEntity {
  spaceId: ID;
  organizationId: ID;
  projectId?: ID | null;
  parentId?: ID | null;
  title: string;
  slug: string;
  icon?: string | null;
  contentJson: Record<string, unknown>;
  contentText: string;
  excerpt?: string | null;
  currentRevision: number;
  position: number;
  isArchived: boolean;
  publicShareEnabled: boolean;
  publicShareToken?: string | null;
  publicShareAllowSearchIndexing: boolean;
  publicShareIncludeAttachments: boolean;
  publicSharePublishedAt?: string | Date | null;
  publicSharePublishedBy?: ID | null;
}

export interface DocumentRevision {
  id: ID;
  pageId: ID;
  revision: number;
  title: string;
  contentJson: Record<string, unknown>;
  contentText: string;
  excerpt?: string | null;
  changeSummary?: string | null;
  createdAt: string | Date;
  createdBy: ID;
}

export interface DocumentTreeNode {
  id: ID;
  title: string;
  slug: string;
  icon?: string | null;
  projectId?: ID | null;
  parentId?: ID | null;
  currentRevision: number;
  updatedAt: string | Date;
  children: DocumentTreeNode[];
}

export interface IssueDocumentLink {
  id: ID;
  issueId: ID;
  pageId: ID;
  createdAt: string | Date;
  updatedAt: string | Date;
  createdBy: ID;
  updatedBy: ID;
}
