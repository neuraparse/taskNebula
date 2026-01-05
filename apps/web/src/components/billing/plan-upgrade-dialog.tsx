'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { PLAN_PRICING } from '@/lib/stripe';
import { useToast } from '@/hooks/use-toast';
import { getStripe } from '@/lib/stripe';

interface PlanUpgradeDialogProps {
  organizationId: string;
  currentPlan: 'free' | 'starter' | 'growth' | 'enterprise';
  trigger?: React.ReactNode;
}

export function PlanUpgradeDialog({ organizationId, currentPlan, trigger }: PlanUpgradeDialogProps) {
  const [open, setOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async (plan: 'starter' | 'growth' | 'enterprise') => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, plan, billingPeriod }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      const stripe = await getStripe();
      
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });
      
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error upgrading plan:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upgrade plan',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Starter',
      key: 'starter' as const,
      description: PLAN_PRICING.starter.description,
      price: billingPeriod === 'monthly' ? PLAN_PRICING.starter.monthly : PLAN_PRICING.starter.yearly,
      features: [
        '15 team members',
        '10 projects',
        '500 issues per project',
        '1 GB storage',
        'Custom fields',
        'API access',
        'Email support',
      ],
    },
    {
      name: 'Growth',
      key: 'growth' as const,
      description: PLAN_PRICING.growth.description,
      price: billingPeriod === 'monthly' ? PLAN_PRICING.growth.monthly : PLAN_PRICING.growth.yearly,
      popular: true,
      features: [
        '50 team members',
        '50 projects',
        '2,000 issues per project',
        '10 GB storage',
        'Advanced workflows',
        'Webhooks',
        'Audit logs',
        'Priority support',
      ],
    },
    {
      name: 'Enterprise',
      key: 'enterprise' as const,
      description: PLAN_PRICING.enterprise.description,
      price: billingPeriod === 'monthly' ? PLAN_PRICING.enterprise.monthly : PLAN_PRICING.enterprise.yearly,
      features: [
        'Unlimited members',
        'Unlimited projects',
        'Unlimited issues',
        'Unlimited storage',
        'SSO/SAML',
        'Custom branding',
        'Advanced analytics',
        'AI features',
        'Dedicated support',
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade Plan
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your team's needs
          </DialogDescription>
        </DialogHeader>

        {/* Billing Period Toggle */}
        <div className="flex items-center justify-center gap-4 my-6">
          <Button
            variant={billingPeriod === 'monthly' ? 'default' : 'outline'}
            onClick={() => setBillingPeriod('monthly')}
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === 'yearly' ? 'default' : 'outline'}
            onClick={() => setBillingPeriod('yearly')}
          >
            Yearly
            <Badge variant="secondary" className="ml-2">Save 17%</Badge>
          </Button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.key;
            const isDowngrade = ['free', 'starter', 'growth', 'enterprise'].indexOf(currentPlan) > ['free', 'starter', 'growth', 'enterprise'].indexOf(plan.key);

            return (
              <div
                key={plan.key}
                className={`relative rounded-lg border-2 p-6 ${
                  plan.popular
                    ? 'border-primary shadow-lg'
                    : 'border-border'
                }`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}

                <div className="mb-4">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground ml-2">
                      /{billingPeriod === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ${Math.round(plan.price / 12)}/month billed annually
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={isCurrentPlan || isDowngrade || loading}
                  onClick={() => handleUpgrade(plan.key)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : isDowngrade ? (
                    'Contact Support'
                  ) : (
                    'Upgrade Now'
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

