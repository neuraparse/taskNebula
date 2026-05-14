import { pgTable, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { users } from './users';

/**
 * Import Jobs
 *
 * Tracks a single issue-import run from an external source (CSV upload,
 * Linear API, Jira API, or GitHub Issues). Source-specific adapters
 * normalize their payload into `NormalizedRecord` then progressively
 * insert rows into TaskNebula's `issues` table while updating
 * `processed` / `errors` on this row so the UI can poll for progress.
 *
 * Statuses: 'pending' (queued), 'running', 'completed', 'failed'.
 *
 * `payloadRef` is an opaque pointer to the raw source payload — e.g.
 * uploaded CSV file id, a snapshot key — that lets the runner stream
 * data without storing the full body in this row.
 */
export const importJobs = pgTable('import_jobs', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),

  // Workspace == organization in TaskNebula's data model.
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),

  // Adapter key: 'csv' | 'linear' | 'jira' | 'github'.
  source: text('source').notNull(),

  // 'pending' | 'running' | 'completed' | 'failed'.
  status: text('status').notNull().default('pending'),

  total: integer('total').notNull().default(0),
  processed: integer('processed').notNull().default(0),

  // Array<{ key?: string; message: string; raw?: unknown }>.
  errors: jsonb('errors').notNull().default('[]'),

  // Opaque pointer the runner uses to retrieve the raw payload. For CSV
  // imports we stash the parsed records inline under `payload` in `mapping`
  // to avoid a separate object store; production should swap this for a
  // proper storage ref.
  payloadRef: text('payload_ref'),

  // Column → TaskNebula field mapping plus adapter-specific config
  // (Linear workspace, Jira site, GitHub repo, etc).
  mapping: jsonb('mapping').notNull().default('{}'),

  createdBy: text('created_by').references(() => users.id, {
    onDelete: 'set null',
  }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
}, (table) => ({
  workspaceIdx: index('import_jobs_workspace_idx').on(table.workspaceId),
  workspaceStatusIdx: index('import_jobs_workspace_status_idx').on(
    table.workspaceId,
    table.status
  ),
  createdAtIdx: index('import_jobs_created_at_idx').on(table.createdAt),
}));

export type ImportJobRecord = typeof importJobs.$inferSelect;
export type NewImportJob = typeof importJobs.$inferInsert;

export type ImportJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export type ImportJobError = {
  key?: string;
  message: string;
  raw?: unknown;
};
