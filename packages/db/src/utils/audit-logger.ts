// QUAL-21 TS-strict-migration: file untouched intentionally; drizzle-orm
// insert types use `T | null` (not `T | undefined`) for optional columns, so
// this file needs targeted fixes when `exactOptionalPropertyTypes` is enabled
// for @tasknebula/db. See docs/TS_STRICT_MIGRATION.md.
import { db } from '../index';
import { auditLogs } from '../schema/audit-logs';
import { webhooks, webhookDeliveries } from '../schema/webhooks';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export type AuditLogAction =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.status_changed'
  | 'issue.assigned'
  | 'issue.unassigned'
  | 'issue.priority_changed'
  | 'issue.labels_changed'
  | 'issue.linked'
  | 'issue.unlinked'
  | 'issue.commented'
  | 'issue.attachment_added'
  | 'issue.attachment_removed'
  | 'issue.custom_field_changed'
  | 'document.created'
  | 'document.updated'
  | 'document.deleted'
  | 'document.restored'
  | 'document.linked_issue'
  | 'document.unlinked_issue'
  | 'document.public_shared'
  | 'document.public_unshared'
  | 'document.public_link_regenerated'
  | 'chat.channel_created'
  | 'chat.channel_updated'
  | 'chat.channel_deleted'
  | 'chat.message_created'
  | 'chat.message_updated'
  | 'chat.message_deleted'
  | 'chat.call_started'
  | 'chat.call_ended'
  | 'agent.config_updated'
  | 'agent.model_config_created'
  | 'agent.model_config_updated'
  | 'agent.model_config_archived'
  | 'agent.run_requested'
  | 'agent.run_completed'
  | 'agent.run_failed'
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'project.member_added'
  | 'project.member_removed'
  | 'sprint.created'
  | 'sprint.updated'
  | 'sprint.deleted'
  | 'sprint.started'
  | 'sprint.completed'
  | 'sprint.issue_added'
  | 'sprint.issue_removed'
  | 'organization.created'
  | 'organization.updated'
  | 'organization.member_added'
  | 'organization.member_removed'
  | 'organization.role_changed'
  | 'custom_field.created'
  | 'custom_field.updated'
  | 'custom_field.deleted'
  | 'webhook.created'
  | 'webhook.updated'
  | 'webhook.deleted'
  | 'webhook.triggered'
  | 'api_key.created'
  | 'api_key.revoked';

interface AuditLogParams {
  userId: string;
  organizationId: string;
  action: AuditLogAction;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  issueId?: string;
  changes?: Record<string, { from: any; to: any }>;
  metadata?: Record<string, any>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(params: AuditLogParams) {
  try {
    const [log] = await db
      .insert(auditLogs)
      .values({
        userId: params.userId,
        organizationId: params.organizationId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        projectId: params.projectId,
        issueId: params.issueId,
        changes: params.changes as any,
        metadata: params.metadata as any,
      })
      .returning();

    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
    return null;
  }
}

/**
 * Helper to detect changes between old and new objects
 */
export function detectChanges<T extends Record<string, any>>(
  oldObj: T,
  newObj: Partial<T>
): Record<string, { from: any; to: any }> | undefined {
  const changes: Record<string, { from: any; to: any }> = {};

  for (const key in newObj) {
    if (newObj[key] !== undefined && oldObj[key] !== newObj[key]) {
      changes[key] = {
        from: oldObj[key],
        to: newObj[key],
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}

/**
 * Helper to log issue updates
 */
export async function logIssueUpdate(params: {
  userId: string;
  organizationId: string;
  issueId: string;
  projectId: string;
  oldIssue: any;
  newIssue: any;
  metadata?: Record<string, any>;
}) {
  const changes = detectChanges(params.oldIssue, params.newIssue);

  if (!changes) {
    return null; // No changes detected
  }

  // Determine specific action based on what changed
  let action: AuditLogAction = 'issue.updated';
  if (changes.status) {
    action = 'issue.status_changed';
  } else if (changes.assigneeId) {
    action = changes.assigneeId.to ? 'issue.assigned' : 'issue.unassigned';
  } else if (changes.priority) {
    action = 'issue.priority_changed';
  } else if (changes.labels) {
    action = 'issue.labels_changed';
  }

  return createAuditLog({
    userId: params.userId,
    organizationId: params.organizationId,
    action,
    resourceType: 'issue',
    resourceId: params.issueId,
    projectId: params.projectId,
    issueId: params.issueId,
    changes,
    metadata: params.metadata,
  });
}

/**
 * Trigger webhooks for an event
 */
export async function triggerWebhooks(params: {
  organizationId: string;
  projectId?: string;
  event: string;
  payload: Record<string, any>;
}) {
  try {
    // Find active webhooks that listen to this event
    const conditions = [
      eq(webhooks.organizationId, params.organizationId),
      eq(webhooks.isActive, true),
    ];

    if (params.projectId) {
      conditions.push(eq(webhooks.projectId, params.projectId));
    }

    const activeWebhooks = await db
      .select()
      .from(webhooks)
      .where(and(...conditions));

    // Filter webhooks that listen to this event
    const matchingWebhooks = activeWebhooks.filter((webhook) => {
      const events = webhook.events as string[];
      return events.includes(params.event);
    });

    // Create delivery records for each webhook
    const deliveryPromises = matchingWebhooks.map(async (webhook) => {
      // Create delivery record
      const [delivery] = await db
        .insert(webhookDeliveries)
        .values({
          webhookId: webhook.id,
          event: params.event as any,
          payload: params.payload as any,
          status: 'pending',
        })
        .returning();

      // Trigger async delivery (don't await)
      if (delivery) {
        deliverWebhook(webhook, delivery.id, params.payload).catch((error) => {
          console.error('Webhook delivery failed:', error);
        });
      }

      return delivery;
    });

    await Promise.all(deliveryPromises);
  } catch (error) {
    console.error('Failed to trigger webhooks:', error);
  }
}

/**
 * Deliver webhook to endpoint
 */
async function deliverWebhook(
  webhook: any,
  deliveryId: string,
  payload: Record<string, any>
) {
  try {
    // Create HMAC signature
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Send webhook
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-ID': deliveryId,
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text();

    // Update delivery record
    await db
      .update(webhookDeliveries)
      .set({
        status: response.ok ? 'success' : 'failed',
        statusCode: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit size
        deliveredAt: new Date(),
        attemptCount: 1,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    // Update webhook stats
    if (response.ok) {
      await db
        .update(webhooks)
        .set({
          successCount: webhook.successCount + 1,
          lastTriggeredAt: new Date(),
        })
        .where(eq(webhooks.id, webhook.id));
    } else {
      await db
        .update(webhooks)
        .set({
          failureCount: webhook.failureCount + 1,
          lastTriggeredAt: new Date(),
        })
        .where(eq(webhooks.id, webhook.id));
    }
  } catch (error: any) {
    // Update delivery record with error
    await db
      .update(webhookDeliveries)
      .set({
        status: 'failed',
        errorMessage: error.message,
        attemptCount: 1,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    // Update webhook failure count
    await db
      .update(webhooks)
      .set({
        failureCount: webhook.failureCount + 1,
      })
      .where(eq(webhooks.id, webhook.id));
  }
}
