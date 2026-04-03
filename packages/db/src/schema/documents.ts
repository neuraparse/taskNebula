import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { projects } from './projects';
import { users } from './users';
import { issues } from './issues';

export const documentSpaceScopeEnum = pgEnum('document_space_scope', ['organization', 'project']);

export const documentSpaces = pgTable('document_spaces', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  scope: documentSpaceScopeEnum('scope').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 120 }).notNull(),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  orgScopeSlugIdx: uniqueIndex('document_space_org_scope_slug_idx').on(table.organizationId, table.scope, table.slug),
  projectIdx: index('document_space_project_idx').on(table.projectId),
  organizationIdx: index('document_space_organization_idx').on(table.organizationId),
}));

export const documentPages = pgTable('document_pages', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  spaceId: text('space_id').notNull().references(() => documentSpaces.id, { onDelete: 'cascade' }),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  parentId: text('parent_id').references((): any => documentPages.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 500 }).notNull(),
  slug: varchar('slug', { length: 200 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  contentJson: jsonb('content_json').notNull().default('{}'),
  contentText: text('content_text').notNull().default(''),
  excerpt: text('excerpt'),
  currentRevision: integer('current_revision').notNull().default(1),
  position: integer('position').notNull().default(0),
  isArchived: boolean('is_archived').notNull().default(false),
  publicShareEnabled: boolean('public_share_enabled').notNull().default(false),
  publicShareToken: varchar('public_share_token', { length: 64 }),
  publicShareAllowSearchIndexing: boolean('public_share_allow_search_indexing').notNull().default(false),
  publicShareIncludeAttachments: boolean('public_share_include_attachments').notNull().default(false),
  publicSharePublishedAt: timestamp('public_share_published_at'),
  publicSharePublishedBy: text('public_share_published_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  spaceSlugIdx: uniqueIndex('document_page_space_parent_slug_idx').on(table.spaceId, table.parentId, table.slug),
  spaceIdx: index('document_page_space_idx').on(table.spaceId),
  parentIdx: index('document_page_parent_idx').on(table.parentId),
  projectIdx: index('document_page_project_idx').on(table.projectId),
  organizationIdx: index('document_page_organization_idx').on(table.organizationId),
  archivedIdx: index('document_page_archived_idx').on(table.isArchived),
  publicShareTokenIdx: uniqueIndex('document_page_public_share_token_idx').on(table.publicShareToken),
  publicShareEnabledIdx: index('document_page_public_share_enabled_idx').on(table.publicShareEnabled),
}));

export const documentPageRevisions = pgTable('document_page_revisions', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  pageId: text('page_id').notNull().references(() => documentPages.id, { onDelete: 'cascade' }),
  revision: integer('revision').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  contentJson: jsonb('content_json').notNull().default('{}'),
  contentText: text('content_text').notNull().default(''),
  excerpt: text('excerpt'),
  changeSummary: text('change_summary'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
}, (table) => ({
  pageRevisionIdx: uniqueIndex('document_page_revision_page_revision_idx').on(table.pageId, table.revision),
  pageIdx: index('document_page_revision_page_idx').on(table.pageId),
}));

export const documentPageLinks = pgTable('document_page_links', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  sourcePageId: text('source_page_id').notNull().references(() => documentPages.id, { onDelete: 'cascade' }),
  targetPageId: text('target_page_id').notNull().references(() => documentPages.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  sourceTargetIdx: uniqueIndex('document_page_link_source_target_idx').on(table.sourcePageId, table.targetPageId),
  sourceIdx: index('document_page_link_source_idx').on(table.sourcePageId),
  targetIdx: index('document_page_link_target_idx').on(table.targetPageId),
}));

export const issueDocumentLinks = pgTable('issue_document_links', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  issueId: text('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  pageId: text('page_id').notNull().references(() => documentPages.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
}, (table) => ({
  issuePageIdx: uniqueIndex('issue_document_link_issue_page_idx').on(table.issueId, table.pageId),
  issueIdx: index('issue_document_link_issue_idx').on(table.issueId),
  pageIdx: index('issue_document_link_page_idx').on(table.pageId),
}));

export const documentPageAttachments = pgTable('document_page_attachments', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),
  pageId: text('page_id').notNull().references(() => documentPages.id, { onDelete: 'cascade' }),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  filePath: text('file_path').notNull(),
  uploadedById: text('uploaded_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  pageIdx: index('document_page_attachment_page_idx').on(table.pageId),
}));
