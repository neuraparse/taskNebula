/**
 * Audit log sinks — SIEM streaming.
 *
 * Each row describes one downstream destination that should receive
 * audit_logs rows in (near) real time. Supported types:
 *  - webhook:    generic HMAC-signed POST (uses signing_secret).
 *  - splunk_hec: Splunk HTTP Event Collector (token header).
 *  - datadog:    Datadog Logs intake (DD-API-KEY header).
 *  - s3:         append JSONL to an S3 bucket, keyed by ISO date.
 *
 * `config` jsonb stores type-specific options (url, bucket, region, etc.).
 * `signing_secret` is used for HMAC over the body for the `webhook` type;
 * the other types use their own auth headers.
 */

import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { organizations } from './organizations';
import { users } from './users';

export const auditLogSinkTypeEnum = pgEnum('audit_log_sink_type', [
  'webhook',
  'splunk_hec',
  'datadog',
  's3',
]);

export const auditLogSinks = pgTable(
  'audit_log_sinks',
  {
    id: text('id').$defaultFn(() => createId()).primaryKey(),

    // We map "workspace_id" to organizationId — workspaces in TaskNebula are
    // organizations.
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),

    type: auditLogSinkTypeEnum('type').notNull(),

    // Friendly label shown in the UI.
    name: text('name').notNull(),

    // Type-specific config: { url, token, bucket, region, ... }.
    config: jsonb('config').notNull().default({}),

    enabled: boolean('enabled').notNull().default(true),

    // HMAC signing key for the generic webhook type, plus a stable identity
    // any receiver can verify against. Always generated server-side.
    signingSecret: text('signing_secret').notNull(),

    // Optional bookkeeping for ops.
    lastDeliveryAt: timestamp('last_delivery_at'),
    lastError: text('last_error'),
    successCount: text('success_count').notNull().default('0'),
    failureCount: text('failure_count').notNull().default('0'),

    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('audit_log_sink_workspace_idx').on(table.workspaceId),
    enabledIdx: index('audit_log_sink_enabled_idx').on(table.enabled),
    workspaceEnabledIdx: index('audit_log_sink_workspace_enabled_idx').on(
      table.workspaceId,
      table.enabled
    ),
  })
);

export type AuditLogSink = typeof auditLogSinks.$inferSelect;
export type NewAuditLogSink = typeof auditLogSinks.$inferInsert;
