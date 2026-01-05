import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@tasknebula/db';
import { pushSubscriptions } from '@tasknebula/db';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const subscriptionSchema = z.object({
  organizationId: z.string(),
  endpoint: z.string(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
  deviceName: z.string().optional(),
});

// GET - List user's push subscriptions
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.organizationId, organizationId)
        )
      )
      .orderBy(pushSubscriptions.createdAt);

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error('Error fetching push subscriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch push subscriptions' },
      { status: 500 }
    );
  }
}

// POST - Create new push subscription
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = subscriptionSchema.parse(body);

    // Check if subscription already exists
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, validatedData.endpoint))
      .limit(1);

    if (existing.length > 0 && existing[0]) {
      // Update existing subscription
      const [updated] = await db
        .update(pushSubscriptions)
        .set({
          keys: validatedData.keys,
          userAgent: validatedData.userAgent,
          deviceName: validatedData.deviceName,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing[0].id))
        .returning();

      return NextResponse.json(updated);
    }

    // Create new subscription
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values({
        userId: session.user.id,
        organizationId: validatedData.organizationId,
        endpoint: validatedData.endpoint,
        keys: validatedData.keys,
        userAgent: validatedData.userAgent,
        deviceName: validatedData.deviceName,
      })
      .returning();

    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error creating push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to create push subscription' },
      { status: 500 }
    );
  }
}

// DELETE - Remove push subscription
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json(
        { error: 'endpoint is required' },
        { status: 400 }
      );
    }

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to delete push subscription' },
      { status: 500 }
    );
  }
}

