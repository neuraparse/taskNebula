import { createId } from '@paralleldrive/cuid2';
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations';

/**
 * Tracks asynchronous LLM batch jobs (OpenAI Batch API, Anthropic Message
 * Batches). Each row mirrors the upstream provider job and records
 * progress so the UI/jobs UI can poll TaskNebula instead of the provider.
 *
 * Workloads routed here:
 *   - Embedding backfill jobs (semantic search)
 *   - Weekly summary agent
 *   - Stale-issue janitor sweep
 *   - Release notes generation
 *   - Triage suggestion backfill
 *
 * Realtime chat / draft-issue endpoints stay on the standard sync API.
 */
export const llmBatchJobs = pgTable('llm_batch_jobs', {
  id: text('id').$defaultFn(() => createId()).primaryKey(),

  // Which org owns the workload (NULL for system-wide jobs like embedding
  // backfill that span all orgs — kept nullable on purpose).
  organizationId: text('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),

  // 'openai' | 'anthropic' — kept as text rather than enum to avoid
  // coupling with the agent_provider enum which excludes 'azure' batch.
  provider: text('provider').notNull(),

  // The provider-side job ID (e.g. `batch_abc123` from OpenAI).
  externalBatchId: text('external_batch_id').notNull(),

  // 'validating' | 'in_progress' | 'finalizing' | 'completed' | 'failed' |
  // 'expired' | 'cancelled'. Mirrors OpenAI's status strings.
  status: text('status').notNull().default('validating'),

  // Logical workload tag so dashboards can group runs.
  // 'embedding_backfill' | 'weekly_summary' | 'stale_janitor' |
  // 'release_notes' | 'triage_backfill' | 'other'.
  workload: text('workload').notNull().default('other'),

  totalRequests: integer('total_requests').notNull().default(0),
  completedRequests: integer('completed_requests').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),

  // Where the JSONL results were written when the batch completed. May be
  // an S3 URI, a local path during dev, or NULL while pending.
  resultsStoragePath: text('results_storage_path'),

  // Arbitrary per-job metadata: the originating cron name, request hashes,
  // cost estimates, etc.
  metadata: jsonb('metadata').notNull().default('{}'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  orgIdx: index('llm_batch_job_org_idx').on(table.organizationId),
  statusIdx: index('llm_batch_job_status_idx').on(table.status),
  providerIdx: index('llm_batch_job_provider_idx').on(table.provider),
  workloadIdx: index('llm_batch_job_workload_idx').on(table.workload),
  externalIdx: index('llm_batch_job_external_idx').on(table.externalBatchId),
  createdAtIdx: index('llm_batch_job_created_at_idx').on(table.createdAt),
}));
