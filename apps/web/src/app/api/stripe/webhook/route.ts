import { NextRequest, NextResponse } from 'next/server';
import { getServerStripe } from '@/lib/stripe';
import { db, organizations, systemAuditLogs } from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = await getServerStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  if (!organizationId) return;

  const stripe = await getServerStripe();
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  const plan = session.metadata?.plan as 'starter' | 'growth' | 'enterprise';

  await db
    .update(organizations)
    .set({
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      plan: plan,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  // Create audit log
  await db.insert(systemAuditLogs).values({
    action: 'subscription.created',
    performedBy: 'system',
    targetType: 'organization',
    targetId: organizationId,
    changes: {
      plan,
      subscriptionId: subscription.id,
    },
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) return;

  const plan = subscription.metadata?.plan as 'starter' | 'growth' | 'enterprise' | undefined;

  await db
    .update(organizations)
    .set({
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
      ...(plan && { plan }),
      status: subscription.status === 'active' ? 'active' : 'suspended',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const organizationId = subscription.metadata?.organizationId;
  if (!organizationId) return;

  await db
    .update(organizations)
    .set({
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
      plan: 'free',
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  // Create audit log
  await db.insert(systemAuditLogs).values({
    action: 'subscription.deleted',
    performedBy: 'system',
    targetType: 'organization',
    targetId: organizationId,
    changes: {
      plan: 'free',
      subscriptionId: subscription.id,
    },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const organizationId = invoice.subscription_details?.metadata?.organizationId;
  if (!organizationId) return;

  // Create audit log
  await db.insert(systemAuditLogs).values({
    action: 'invoice.payment_succeeded',
    performedBy: 'system',
    targetType: 'organization',
    targetId: organizationId,
    changes: {
      invoiceId: invoice.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const organizationId = invoice.subscription_details?.metadata?.organizationId;
  if (!organizationId) return;

  // Create audit log
  await db.insert(systemAuditLogs).values({
    action: 'invoice.payment_failed',
    performedBy: 'system',
    targetType: 'organization',
    targetId: organizationId,
    changes: {
      invoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
    },
  });

  // Optionally: Send notification to organization owner
  // TODO: Implement notification system
}

