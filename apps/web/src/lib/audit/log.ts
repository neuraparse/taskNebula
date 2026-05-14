/**
 * Audit log helper — single entry point that writes to `audit_logs` AND
 * fan-outs to every enabled audit_log_sinks row for the workspace.
 *
 * This wraps the lower-level `createAuditLog` helper from @tasknebula/db so
 * existing callers can be migrated incrementally. Both calls are
 * fire-and-forget at the sink boundary — failing to deliver to a SIEM must
 * never break the originating user action.
 */

import { createAuditLog as createAuditLogRow } from '@tasknebula/db';
import type { AuditLogAction } from '@tasknebula/db';
import { dispatchAuditLogToSinks } from './sink-dispatcher';

export interface RecordAuditLogParams {
  userId: string;
  organizationId: string;
  action: AuditLogAction;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  issueId?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  metadata?: Record<string, unknown>;
}

/**
 * Persist an audit log row and fan it out to every enabled SIEM sink.
 *
 * The streaming dispatch is fire-and-forget — we kick it off with
 * `void` so the caller's request returns immediately. We never throw.
 */
export async function recordAuditLog(params: RecordAuditLogParams) {
  const row = await createAuditLogRow(params);
  if (row) {
    // Fire-and-forget. The dispatcher itself never throws, but we wrap in
    // a try/catch and use `void` to make the contract explicit.
    void dispatchAuditLogToSinks({
      id: row.id,
      workspaceId: row.organizationId,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      userId: row.userId,
      projectId: row.projectId,
      issueId: row.issueId,
      changes: (row.changes as Record<string, unknown> | null) ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    }).catch((err) => {
      console.error('[audit-sink] dispatch threw unexpectedly', err);
    });
  }
  return row;
}
