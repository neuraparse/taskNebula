import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, webhooks } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const updateWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/webhooks/[webhookId]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { webhookId } = await params;
    const body = await request.json();
    const validatedData = updateWebhookSchema.parse(body);

    const [existingWebhook] = await db
      .select({
        id: webhooks.id,
        organizationId: webhooks.organizationId,
      })
      .from(webhooks)
      .where(eq(webhooks.id, webhookId))
      .limit(1);

    if (!existingWebhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const canManage = await hasPermission(existingWebhook.organizationId, 'webhook:manage');
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const [updatedWebhook] = await db
      .update(webhooks)
      .set({
        ...validatedData,
        events: validatedData.events as any,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhookId))
      .returning();

    return NextResponse.json(updatedWebhook);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    console.error('Error updating webhook:', error);
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }
}

// DELETE /api/webhooks/[webhookId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ webhookId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { webhookId } = await params;

    const [existingWebhook] = await db
      .select({
        id: webhooks.id,
        organizationId: webhooks.organizationId,
      })
      .from(webhooks)
      .where(eq(webhooks.id, webhookId))
      .limit(1);

    if (!existingWebhook) {
      return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const canDelete = await hasPermission(existingWebhook.organizationId, 'webhook:delete');
    if (!canDelete) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    await db.delete(webhooks).where(eq(webhooks.id, webhookId));

    return NextResponse.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
