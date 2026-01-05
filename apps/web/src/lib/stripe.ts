import { loadStripe, Stripe as StripeClient } from '@stripe/stripe-js';

// Server-side Stripe instance (lazy loaded to avoid client-side errors)
export const getServerStripe = async () => {
  if (typeof window !== 'undefined') {
    throw new Error('Server-side Stripe instance cannot be used on the client');
  }
  const Stripe = (await import('stripe')).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
  });
};

// Client-side Stripe instance (singleton)
let stripePromise: Promise<StripeClient | null>;
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Stripe Price IDs for each plan
export const STRIPE_PRICE_IDS = {
  starter: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE_ID!,
    yearly: process.env.NEXT_PUBLIC_STRIPE_STARTER_YEARLY_PRICE_ID!,
  },
  growth: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_GROWTH_MONTHLY_PRICE_ID!,
    yearly: process.env.NEXT_PUBLIC_STRIPE_GROWTH_YEARLY_PRICE_ID!,
  },
  enterprise: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID!,
    yearly: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_YEARLY_PRICE_ID!,
  },
} as const;

// Plan pricing (for display purposes)
export const PLAN_PRICING = {
  free: {
    monthly: 0,
    yearly: 0,
    name: 'Free',
    description: 'Perfect for small teams getting started',
  },
  starter: {
    monthly: 29,
    yearly: 290, // ~$24/month
    name: 'Starter',
    description: 'For growing teams that need more power',
  },
  growth: {
    monthly: 99,
    yearly: 990, // ~$82/month
    name: 'Growth',
    description: 'For established teams with advanced needs',
  },
  enterprise: {
    monthly: 299,
    yearly: 2990, // ~$249/month
    name: 'Enterprise',
    description: 'For large organizations with custom requirements',
  },
} as const;

// Helper to get price ID based on plan and billing period
export function getPriceId(plan: 'starter' | 'growth' | 'enterprise', billingPeriod: 'monthly' | 'yearly'): string {
  return STRIPE_PRICE_IDS[plan][billingPeriod];
}

// Helper to get plan from price ID
export function getPlanFromPriceId(priceId: string): { plan: 'starter' | 'growth' | 'enterprise'; billingPeriod: 'monthly' | 'yearly' } | null {
  for (const [plan, prices] of Object.entries(STRIPE_PRICE_IDS)) {
    for (const [period, id] of Object.entries(prices)) {
      if (id === priceId) {
        return {
          plan: plan as 'starter' | 'growth' | 'enterprise',
          billingPeriod: period as 'monthly' | 'yearly',
        };
      }
    }
  }
  return null;
}

