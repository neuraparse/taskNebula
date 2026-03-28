import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, webhooks } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const createWebhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  organizationId: z.string(),
  projectId: z.string().optional(),
  events: z.array(z.string()).min(1),
});

// Generate a webhook secret
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

// GET /api/webhooks?organizationId=xxx&projectId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const projectId = searchParams.get('projectId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    // Build query conditions
    const conditions = [eq(webhooks.organizationId, organizationId)];
    if (projectId) {
      conditions.push(eq(webhooks.projectId, projectId));
    }

    // Fetch webhooks
    const webhookList = await db
      .select({
        id: webhooks.id,
        name: webhooks.name,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        lastTriggeredAt: webhooks.lastTriggeredAt,
        successCount: webhooks.successCount,
        failureCount: webhooks.failureCount,
        createdAt: webhooks.createdAt,
        updatedAt: webhooks.updatedAt,
      })
      .from(webhooks)
      .where(eq(webhooks.organizationId, organizationId));

    return NextResponse.json({ webhooks: webhookList });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json({ error: 'Failed to fetch webhooks' }, { status: 500 });
  }
}

// POST /api/webhooks
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createWebhookSchema.parse(body);

    // Generate webhook secret
    const secret = generateWebhookSecret();

    // Create webhook
    const [newWebhook] = await db
      .insert(webhooks)
      .values({
        name: validatedData.name,
        url: validatedData.url,
        secret,
        organizationId: validatedData.organizationId,
        projectId: validatedData.projectId,
        events: validatedData.events as any,
        createdBy: session.user.id,
      })
      .returning();

    return NextResponse.json({
      webhook: {
        ...newWebhook,
        secret, // Show secret only on creation
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    console.error('Error creating webhook:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

