/**
 * Webhook dispatcher.
 *
 * Loads active webhook subscriptions for an organization and (optionally) a
 * project, signs the payload with HMAC-SHA256 using the row's `secret`, posts
 * to each subscriber's URL, and records a delivery row plus updates the
 * success / failure counters on the parent webhook.
 *
 * Designed to be fire-and-forget: callers should invoke `void triggerWebhooks(...)`
 * — the function never throws and never rejects, mirroring the safety invariant
 * of `runAutomations`.
 *
 * Headers emitted:
 *   - X-TaskNebula-Event:     the event name (e.g. issue.created)
 *   - X-TaskNebula-Signature: sha256=<hmac> over the raw JSON body
 *   - X-TaskNebula-Delivery:  unique id of the delivery row (for idempotency)
 *   - X-Webhook-Signature:    legacy alias of the signature (without prefix)
 *   - X-Webhook-ID:           webhook id, useful for receiver-side debugging
 */

import crypto from 'crypto';
import {
  db,
  webhooks,
  webhookDeliveries,
  and,
  eq,
  or,
  isNull,
} from '@tasknebula/db';

// Mirrors the values defined in webhookEventEnum (packages/db/src/schema/webhooks.ts).
// Keep this in sync whenever the enum is extended.
export type WebhookEvent =
  | 'issue.created'
  | 'issue.updated'
  | 'issue.deleted'
  | 'issue.status_changed'
  | 'issue.assigned'
  | 'issue.commented'
  | 'sprint.started'
  | 'sprint.completed'
  | 'project.created'
  | 'project.updated';

export const WEBHOOK_EVENTS: readonly WebhookEvent[] = [
  'issue.created',
  'issue.updated',
  'issue.deleted',
  'issue.status_changed',
  'issue.assigned',
  'issue.commented',
  'sprint.started',
  'sprint.completed',
  'project.created',
  'project.updated',
] as const;

const REQUEST_TIMEOUT_MS = 10_000;

export interface TriggerWebhooksParams {
  organizationId: string;
  projectId?: string | null;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  /** Optional caller id, included in the signed envelope so receivers can audit. */
  actorUserId?: string | null;
}

export interface DeliveryOutcome {
  webhookId: string;
  url: string;
  status: 'success' | 'failed';
  statusCode: number | null;
  durationMs: number;
  error: string | null;
}

interface MatchedWebhook {
  id: string;
  url: string;
  secret: string;
  successCount: number;
  failureCount: number;
}

/**
 * Sign the payload string with HMAC-SHA256 using the per-webhook secret.
 * Exported so the test endpoint and tests can share the same primitive.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Filter webhook rows by checking whether their `events` JSONB array includes
 * the trigger event. We do this in JS instead of SQL `@>` because the existing
 * column is typed jsonb and the array shape is shallow — fine for the volumes
 * we expect (<100 webhooks per org).
 */
function eventMatches(events: unknown, event: WebhookEvent): boolean {
  if (!Array.isArray(events)) return false;
  return events.includes(event);
}

async function loadMatchingWebhooks(
  organizationId: string,
  projectId: string | null,
  event: WebhookEvent
): Promise<MatchedWebhook[]> {
  const rows = await db
    .select({
      id: webhooks.id,
      url: webhooks.url,
      secret: webhooks.secret,
      events: webhooks.events,
      successCount: webhooks.successCount,
      failureCount: webhooks.failureCount,
    })
    .from(webhooks)
    .where(
      and(
        eq(webhooks.organizationId, organizationId),
        eq(webhooks.isActive, true),
        // Either org-wide (projectId IS NULL) or scoped to this project.
        projectId
          ? or(eq(webhooks.projectId, projectId), isNull(webhooks.projectId))
          : isNull(webhooks.projectId)
      )
    );

  return rows
    .filter((row) => eventMatches(row.events, event))
    .map(({ id, url, secret, successCount, failureCount }) => ({
      id,
      url,
      secret,
      successCount,
      failureCount,
    }));
}

interface DeliveryAttempt {
  statusCode: number | null;
  responseBody: string;
  ok: boolean;
  errorMessage: string | null;
  durationMs: number;
}

async function deliverOnce(
  webhook: MatchedWebhook,
  event: WebhookEvent,
  bodyString: string,
  signature: string,
  deliveryId: string
): Promise<DeliveryAttempt> {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let statusCode: number | null = null;
    let responseBody = '';
    let ok = false;
    let errorMessage: string | null = null;
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-TaskNebula-Event': event,
          'X-TaskNebula-Signature': `sha256=${signature}`,
          'X-TaskNebula-Delivery': deliveryId,
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': webhook.id,
        },
        body: bodyString,
      });
      statusCode = response.status;
      responseBody = (await response.text()).slice(0, 1000);
      ok = response.ok;
      if (!ok) errorMessage = `HTTP ${response.status}`;
    } finally {
      clearTimeout(timeout);
    }
    return {
      statusCode,
      responseBody,
      ok,
      errorMessage,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
          : err.message
        : String(err);
    return {
      statusCode: null,
      responseBody: '',
      ok: false,
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    };
  }
}

async function recordDelivery(
  webhook: MatchedWebhook,
  event: WebhookEvent,
  payload: unknown,
  attempt: DeliveryAttempt
): Promise<void> {
  try {
    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event: event as never,
      payload: payload as never,
      status: attempt.ok ? 'success' : 'failed',
      statusCode: attempt.statusCode ?? undefined,
      responseBody: attempt.responseBody || undefined,
      errorMessage: attempt.errorMessage ?? undefined,
      attemptCount: 1,
      deliveredAt: attempt.statusCode !== null ? new Date() : undefined,
    });
  } catch (err) {
    console.error('[webhook] failed to record delivery', {
      webhookId: webhook.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function updateWebhookStats(
  webhook: MatchedWebhook,
  attempt: DeliveryAttempt
): Promise<void> {
  try {
    await db
      .update(webhooks)
      .set({
        successCount: webhook.successCount + (attempt.ok ? 1 : 0),
        failureCount: webhook.failureCount + (attempt.ok ? 0 : 1),
        lastTriggeredAt: new Date(),
      })
      .where(eq(webhooks.id, webhook.id));
  } catch (err) {
    console.error('[webhook] failed to update stats', {
      webhookId: webhook.id,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Fan-out a webhook event to every active subscriber that matches.
 *
 * Safety:
 * - Never throws — all errors are logged and the returned promise resolves.
 * - Each subscriber is delivered independently; one bad URL does not affect
 *   others.
 * - HMAC signature is computed over the *exact* serialized body the receiver
 *   will get, so the signature header always validates.
 */
export async function triggerWebhooks(
  params: TriggerWebhooksParams
): Promise<DeliveryOutcome[]> {
  const outcomes: DeliveryOutcome[] = [];

  let matched: MatchedWebhook[];
  try {
    matched = await loadMatchingWebhooks(
      params.organizationId,
      params.projectId ?? null,
      params.event
    );
  } catch (err) {
    console.error('[webhook] failed to load subscribers', {
      organizationId: params.organizationId,
      event: params.event,
      err: err instanceof Error ? err.message : String(err),
    });
    return outcomes;
  }

  if (matched.length === 0) return outcomes;

  const envelope = {
    event: params.event,
    organizationId: params.organizationId,
    projectId: params.projectId ?? null,
    actorUserId: params.actorUserId ?? null,
    timestamp: new Date().toISOString(),
    data: params.payload,
  };
  const bodyString = JSON.stringify(envelope);

  // Run subscribers in parallel. We cap concurrency by relying on the
  // platform's outbound fetch pool — for typical org sizes (< 50 webhooks
  // per event) this is fine and keeps latency for the originating mutation
  // negligible since the caller uses `void triggerWebhooks(...)`.
  await Promise.all(
    matched.map(async (webhook) => {
      const signature = signWebhookPayload(bodyString, webhook.secret);
      const deliveryId = crypto.randomBytes(12).toString('hex');
      const attempt = await deliverOnce(
        webhook,
        params.event,
        bodyString,
        signature,
        deliveryId
      );
      await Promise.all([
        recordDelivery(webhook, params.event, envelope, attempt),
        updateWebhookStats(webhook, attempt),
      ]);
      outcomes.push({
        webhookId: webhook.id,
        url: webhook.url,
        status: attempt.ok ? 'success' : 'failed',
        statusCode: attempt.statusCode,
        durationMs: attempt.durationMs,
        error: attempt.errorMessage,
      });
    })
  );

  return outcomes;
}
