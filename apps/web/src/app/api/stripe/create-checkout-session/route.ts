import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getServerStripe, getPriceId } from '@/lib/stripe';
import { db, organizations } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { hasPermission } from '@/lib/auth/permissions';

const createCheckoutSessionSchema = z.object({
  organizationId: z.string(),
  plan: z.enum(['starter', 'growth', 'enterprise']),
  billingPeriod: z.enum(['monthly', 'yearly']),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createCheckoutSessionSchema.parse(body);

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

    // Get price ID
    const priceId = getPriceId(validatedData.plan, validatedData.billingPeriod);

    // Get Stripe instance
    const stripe = await getServerStripe();

    // Create or retrieve Stripe customer
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email!,
        metadata: {
          organizationId: org.id,
          userId: session.user.id,
        },
      });
      customerId = customer.id;

      // Update organization with customer ID
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, org.id));
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
      metadata: {
        organizationId: org.id,
        plan: validatedData.plan,
        billingPeriod: validatedData.billingPeriod,
      },
      subscription_data: {
        metadata: {
          organizationId: org.id,
          plan: validatedData.plan,
        },
      },
    });

    return NextResponse.json({ sessionId: checkoutSession.id, url: checkoutSession.url });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

