import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, webhooks, webhookDeliveries } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

// POST /api/webhooks/[webhookId]/test
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { webhookId } = await params;

    // Load full webhook record (including secret)
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.id, webhookId))
      .limit(1);

    if (!webhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const canManage = await hasPermission(webhook.organizationId, 'webhook:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Build the synthetic test payload
    const timestamp = new Date().toISOString();
    const payload = {
      event: 'webhook.test' as const,
      data: {
        message: 'Test delivery from TaskNebula',
        timestamp,
      },
      webhookId: webhook.id,
    };

    const payloadString = JSON.stringify(payload);

    // Sign with HMAC-SHA256 using the same method as triggerWebhooks
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(payloadString)
      .digest('hex');

    // Deliver the webhook and time the round-trip
    const startedAt = Date.now();
    let statusCode: number | null = null;
    let responseBody = '';
    let success = false;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TaskNebula-Event': 'webhook.test',
          'X-TaskNebula-Signature': `sha256=${signature}`,
          'X-Webhook-Signature': signature,
          'X-Webhook-ID': webhook.id,
        },
        body: payloadString,
      });

      statusCode = response.status;
      responseBody = await response.text();
      success = response.ok;
      if (!success) {
        errorMessage = `HTTP ${response.status}`;
      }
    } catch (err: any) {
      errorMessage = err?.message || 'Request failed';
      success = false;
    }

    const durationMs = Date.now() - startedAt;

    // Pick an event enum value for the delivery record.
    // The webhook_deliveries.event column uses the restrictive webhookEventEnum
    // which does NOT include 'webhook.test', so we reuse the first subscribed
    // event (or fall back to 'issue.updated') while recording the real event
    // inside the payload itself.
    const subscribedEvents = Array.isArray(webhook.events)
      ? (webhook.events as string[])
      : [];
    const deliveryEvent = (subscribedEvents[0] || 'issue.updated') as any;

    // Record delivery attempt
    try {
      await db.insert(webhookDeliveries).values({
        webhookId: webhook.id,
        event: deliveryEvent,
        payload: payload as any,
        status: success ? 'success' : 'failed',
        statusCode: statusCode ?? undefined,
        responseBody: responseBody ? responseBody.substring(0, 1000) : undefined,
        errorMessage: errorMessage ?? undefined,
        attemptCount: 1,
        deliveredAt: statusCode !== null ? new Date() : undefined,
      });
    } catch (deliveryErr) {
      console.error('Failed to record webhook test delivery:', deliveryErr);
    }

    // Update webhook stats
    try {
      if (success) {
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
    } catch (statsErr) {
      console.error('Failed to update webhook stats after test:', statsErr);
    }

    const responseSnippet = responseBody ? responseBody.substring(0, 200) : '';

    return NextResponse.json({
      success,
      statusCode,
      responseSnippet,
      durationMs,
      error: errorMessage ?? undefined,
    });
  } catch (error) {
    console.error('Error sending test webhook:', error);
    return NextResponse.json(
      { error: 'Failed to send test webhook' },
      { status: 500 }
    );
  }
}
