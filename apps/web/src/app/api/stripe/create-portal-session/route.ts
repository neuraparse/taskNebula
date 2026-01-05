import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServerStripe } from '@/lib/stripe';
import { db, organizations } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hasPermission } from '@/lib/auth/permissions';

const createPortalSessionSchema = z.object({
  organizationId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPortalSessionSchema.parse(body);

    // Check if user has permission to manage billing
    const canManageBilling = await hasPermission(validatedData.organizationId, 'org:update');
    if (!canManageBilling) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, validatedData.organizationId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!org.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found for this organization' },
        { status: 400 }
      );
    }

    // Get Stripe instance
    const stripe = await getServerStripe();

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}

